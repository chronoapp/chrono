from datetime import datetime, timedelta

from sqlalchemy import desc, and_
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from googleapiclient.errors import HttpError

from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND

from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.api.events.event_utils import (
    EventBaseVM,
    EventInDBVM,
    createOrUpdateEvent,
    getAllExpandedRecurringEvents,
)
from app.api.endpoints.labels import LabelInDbVM, Label, combineLabels
from app.calendar.google import (
    insertGoogleEvent,
    deleteGoogleEvent,
    updateGoogleEvent,
    moveGoogleEvent,
)
from app.db.models import Event, User

router = APIRouter()


def getCombinedLabels(user: User, labelVMs: List[LabelInDbVM]) -> List[Label]:
    """"List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []
    for labelVM in labelVMs:
        label = user.labels.filter_by(id=labelVM.id).one_or_none()
        if label:
            labels.append(label)

    return combineLabels(labels)


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
        datetime.fromisoformat(start_date) if start_date else datetime.now() - timedelta(days=365)
    )
    endDate = datetime.fromisoformat(end_date) if end_date else datetime.now()

    logger.info(f'getEvents:{user.id}')
    logger.info(f'query:{query}')

    if title:
        return (
            user.getEvents()
            .filter(and_(Event.start <= datetime.now(), Event.title.ilike(title)))
            .all()
        )
    elif query:
        tsQuery = ' & '.join(query.split())
        return Event.search(session, user.id, tsQuery, limit=limit).all()
    else:
        singleEvents = (
            user.getEvents()
            .filter(and_(Event.start >= startDate, Event.start <= endDate))
            .order_by(desc(Event.start))
            .limit(limit)
            .all()
        )
        expandedRecurringEvents = getAllExpandedRecurringEvents(user, startDate, endDate, session)

        return list(expandedRecurringEvents) + singleEvents


@router.post('/events/', response_model=EventInDBVM)
async def createEvent(
    event: EventBaseVM, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Event:
    try:
        calendarDb = user.calendars.filter_by(id=event.calendar_id).one_or_none()
        eventDb = Event(
            None,
            event.title,
            event.description,
            event.start,
            event.end,
            event.start_day,
            event.end_day,
            event.calendar_id,
            None,
            event.recurrences,
        )

        eventDb.labels = getCombinedLabels(user, event.labels)
        eventDb.calendar = calendarDb
        user.events.append(eventDb)

        if user.syncWithGoogle():
            resp = insertGoogleEvent(user, eventDb)
            logger.info(resp.get('start'))
            logger.info(resp.get('id'))
            eventDb.g_id = resp.get('id')

        session.add(eventDb)
        session.commit()

        return eventDb

    except Exception as e:
        logger.error(e)
        raise HTTPException(HTTP_400_BAD_REQUEST)


@router.get('/events/{event_id}', response_model=EventInDBVM)
async def getEvent(
    event_id: str, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Event:

    event = user.events.filter_by(id=event_id).one_or_none()
    if not event:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return event


@router.put('/events/{event_id}', response_model=EventInDBVM)
async def updateEvent(
    event: EventBaseVM,
    event_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Event:

    existingEvent = user.events.filter_by(id=event_id).one_or_none()

    if existingEvent and not existingEvent.isWritable():
        raise HTTPException(HTTP_403_FORBIDDEN, detail='Can not update event.')

    eventDb, prevCalendarId = createOrUpdateEvent(existingEvent, event)

    eventDb.labels.clear()
    eventDb.labels = getCombinedLabels(user, event.labels)

    if user.syncWithGoogle():
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
    session.refresh(eventDb)

    return eventDb


@router.delete('/events/{eventId}')
async def deleteEvent(
    eventId: str, user: User = Depends(get_current_user), session: Session = Depends(get_db)
):
    """Delete an event.
    TODO: Handle recurring events.
    - Option to delete this event only.
    """
    logger.info(f'Delete Event {eventId}')
    event = user.events.filter_by(id=eventId).one_or_none()
    if event:
        if event.g_id:
            try:
                deleteGoogleEvent(user, event)
            except HttpError as e:
                logger.error(e)

        session.delete(event)
        session.commit()

    return {}
