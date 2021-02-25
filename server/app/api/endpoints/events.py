from datetime import datetime, timedelta

from sqlalchemy import desc, and_, select
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from googleapiclient.errors import HttpError

from fastapi import APIRouter, Depends, HTTPException, status
from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.api.events.event_utils import (
    InputError,
    EventBaseVM,
    EventInDBVM,
    createOrUpdateEvent,
    getAllExpandedRecurringEvents,
    getRecurringEventId,
    verifyRecurringEvent,
    verifyAndGetRecurringEventParent,
)
from app.api.endpoints.labels import LabelInDbVM, Label, combineLabels
from app.calendar.google import (
    insertGoogleEvent,
    deleteGoogleEvent,
    updateGoogleEvent,
    moveGoogleEvent,
)
from app.db.models import Event, User, Calendar

router = APIRouter()


@router.get('/events/', response_model=List[EventInDBVM])
async def getEvents(
    title: str = "",
    query: str = "",
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> List[Union[EventInDBVM, Event]]:
    """
    TODO: Validate fields: date
    TODO: Filter queries for recurring events
    """
    startDate = (
        datetime.fromisoformat(start_date) if start_date else datetime.now() - timedelta(days=30)
    )
    endDate = datetime.fromisoformat(end_date) if end_date else datetime.now()

    logger.info(f'getEvents:{user.id}')
    logger.info(f'query:{query}')

    if title:
        return (
            user.getSingleEvents(showRecurring=False)
            .filter(
                and_(Event.start >= startDate, Event.start <= endDate, Event.title.ilike(title))
            )
            .limit(limit)
            .all()
        )

    elif query:
        tsQuery = ' & '.join(query.split())
        return Event.search(session, user.id, tsQuery, limit=limit).all()

    else:
        singleEvents = (
            user.getSingleEvents(showRecurring=False)
            .filter(and_(Event.start >= startDate, Event.start <= endDate))
            .order_by(desc(Event.start))
            .limit(limit)
            .all()
        )
        expandedRecurringEvents = getAllExpandedRecurringEvents(user, startDate, endDate, session)
        allEvents = list(expandedRecurringEvents) + singleEvents

        return sorted(allEvents, key=lambda event: event.start)


@router.post('/events/', response_model=EventInDBVM)
async def createEvent(
    event: EventBaseVM, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Event:
    try:
        calendarDb: Calendar = user.calendars.filter_by(id=event.calendar_id).one_or_none()
        if not calendarDb:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Calendar not found.')

        if event.recurring_event_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Can not modify recurring event from this endpoint.',
            )

        eventDb = createOrUpdateEvent(None, event)
        eventDb.labels = getCombinedLabels(user, event.labels, session)
        eventDb.calendar = calendarDb
        user.events.append(eventDb)

        if calendarDb.google_id:
            resp = insertGoogleEvent(user, eventDb)
            eventDb.g_id = resp.get('id')

        session.commit()

        return eventDb

    except Exception as e:
        logger.error(e)
        raise HTTPException(status.HTTP_400_BAD_REQUEST)


@router.get('/events/{event_id}', response_model=EventInDBVM)
async def getEvent(
    event_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Event:
    """TODO: Fetch recurring event."""
    event = user.events.filter_by(id=event_id).one_or_none()
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    return event


@router.put('/events/{event_id}', response_model=EventInDBVM)
async def updateEvent(
    event: EventBaseVM,
    event_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Event:
    """Update an existing event. For recurring events, create the "override" event
    in the DB with the composite id of {baseId}_{date}.

    TODO: Handle move between different calendars
    """
    curEvent: Optional[Event] = user.events.filter_by(id=event_id).one_or_none()

    if curEvent and not curEvent.isWritable():
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail='Can not update event.')

    # Not found in DB.
    elif not curEvent and not event.recurring_event_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Event not found.')

    # New recurring event with override.
    elif not curEvent and event.recurring_event_id:
        parentEvent = user.events.filter_by(id=event.recurring_event_id).one_or_none()
        if not parentEvent:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail=f'Invalid parent event {event.recurring_event_id}.',
            )

        try:
            _, dt = verifyRecurringEvent(user, event_id, parentEvent)
        except InputError as err:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(err))

        googleId = None
        if parentEvent.g_id:
            googleId = getRecurringEventId(parentEvent.recurring_event_gId, dt, event.isAllDay())

        prevCalendarId = None

        # Store original starts
        event.original_start = dt
        event.original_start_day = dt.strftime('%Y-%m-%d') if event.isAllDay() else None
        event.original_timezone = event.timezone

        eventDb = createOrUpdateEvent(None, event, overrideId=event_id, googleId=googleId)

        user.events.append(eventDb)
        session.commit()
        session.refresh(eventDb)
        logger.info(f'Created Override: {eventDb}')

    # Update normal event.
    else:
        prevCalendarId = curEvent.calendar_id if curEvent else None
        eventDb = createOrUpdateEvent(curEvent, event)
        logger.info(f'Updated Event: {eventDb}')

    eventDb.labels.clear()
    eventDb.labels = getCombinedLabels(user, event.labels, session)

    if eventDb.calendar.google_id:
        if prevCalendarId and prevCalendarId != eventDb.calendar_id:
            if eventDb.recurring_event:
                # Move one event => all events.
                eventDb.recurring_event.calendar_id = eventDb.calendar_id
                allRecurringEvents = user.events.filter(
                    Event.recurring_event_id == eventDb.recurring_event_id
                )
                for e in allRecurringEvents:
                    e.calendar_id = eventDb.calendar_id

                moveGoogleEvent(user, eventDb.recurring_event, prevCalendarId)
            else:
                moveGoogleEvent(user, eventDb, prevCalendarId)

        updateGoogleEvent(user, eventDb)

    session.commit()

    return eventDb


@router.delete('/events/{eventId}')
async def deleteEvent(
    eventId: str, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    """Delete an event.
    If the ID does not exist in the DB, it could be a "virtual ID" for a recurring event,
    in which case we'd need to create an override Event to model a deleted event.
    """
    logger.info(f'Delete Event {eventId}')
    event = user.events.filter(and_(Event.id == eventId, Event.status != 'deleted')).one_or_none()

    if not event:
        try:
            event = createOverrideDeletedEvent(user, eventId, session)
            user.events.append(event)

        except InputError as e:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))

    if event:
        if event.g_id:
            try:
                deleteGoogleEvent(user, event)
            except HttpError as e:
                logger.error(e)

        event.status = 'deleted'

        for recurringEvent in event.recurring_events:
            session.delete(recurringEvent)

        session.commit()

    return {}


def getCombinedLabels(user: User, labelVMs: List[LabelInDbVM], session: Session) -> List[Label]:
    """"List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []
    for labelVM in labelVMs:
        stmt = select(Label).where(and_(User.id == user.id, Label.id == labelVM.id))
        label = session.execute(stmt).scalar()

        if label:
            labels.append(label)

    return combineLabels(labels)


def createOverrideDeletedEvent(user: User, eventId: str, session):
    # Override as a deleted event.
    parentEvent, dt = verifyAndGetRecurringEventParent(user, eventId, session)

    googleId = None
    if parentEvent.recurring_event_gId:
        googleId = getRecurringEventId(parentEvent.recurring_event_gId, dt, parentEvent.all_day)

    event = Event(
        googleId,
        None,
        None,
        None,
        None,
        None,
        None,
        parentEvent.calendar.id,
        None,
        None,
        dt,
        dt.strftime('%Y-%m-%d') if parentEvent.all_day else None,
        parentEvent.time_zone,
        overrideId=eventId,
        recurringEventId=parentEvent.id,
        status='deleted',
    )

    return event
