import heapq
from datetime import datetime, timedelta
from typing import List, Optional, Union, Iterable
from googleapiclient.errors import HttpError
from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy import asc, and_, select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.api.events.event_utils import (
    InputError,
    EventBaseVM,
    EventInDBVM,
    createOrUpdateEvent,
    getRecurringEventId,
    verifyRecurringEvent,
    verifyAndGetRecurringEventParent,
    getAllExpandedRecurringEventsList,
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
    session: AsyncSession = Depends(get_db),
) -> Iterable[Union[EventInDBVM, Event]]:
    """
    TODO: Validate fields: date
    TODO: Filter queries for recurring events
    TODO: Figure out how to gather async queries
    """
    try:
        startDate = (
            datetime.fromisoformat(start_date)
            if start_date
            else datetime.now() - timedelta(days=30)
        )
        endDate = datetime.fromisoformat(end_date) if end_date else datetime.now()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid date format: {e}'
        )

    if title:
        selectStmt = (
            user.getSingleEventsStmt(showRecurring=False)
            .filter(and_(Event.end >= startDate, Event.start <= endDate, Event.title.ilike(title)))
            .limit(limit)
        )
        result = await session.execute(selectStmt)
        return result.scalars().all()

    elif query:
        # TODO: Search in recurring events.
        tsQuery = ' & '.join(query.split())
        return await Event.search(session, user.id, tsQuery, limit=limit)

    else:
        selectStmt = (
            user.getSingleEventsStmt(showRecurring=False)
            .filter(and_(Event.end >= startDate, Event.start <= endDate))
            .order_by(asc(Event.start))
            .limit(limit)
        )
        result = await session.execute(selectStmt)
        singleEvents = result.scalars().all()
        expandedRecurringEvents = await getAllExpandedRecurringEventsList(
            user, startDate, endDate, session
        )

        allEvents = heapq.merge(
            expandedRecurringEvents, singleEvents, key=lambda event: event.start
        )
        return allEvents


@router.post('/events/', response_model=EventInDBVM)
async def createEvent(
    event: EventBaseVM,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Event:
    try:
        result = await session.execute(
            select(Calendar).where(
                and_(Calendar.user_id == user.id, Calendar.id == event.calendar_id)
            )
        )
        calendarDb: Optional[Calendar] = result.scalar()

        if not calendarDb:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Calendar not found.')

        if event.recurring_event_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Can not modify recurring event from this endpoint.',
            )

        # Write original starts if this is a recurring event.
        if event.recurrences:
            event.original_start = event.start
            event.original_start_day = event.start_day
            event.original_timezone = event.timezone

        eventDb = createOrUpdateEvent(None, event)
        eventDb.labels = await getCombinedLabels(user, event.labels, session)

        eventDb.calendar = calendarDb
        user.events.append(eventDb)

        if calendarDb.google_id:
            resp = insertGoogleEvent(user, eventDb)
            eventDb.g_id = resp.get('id')

        await session.commit()

        return eventDb

    except Exception as e:
        logger.error(e)
        raise HTTPException(status.HTTP_400_BAD_REQUEST)


@router.get('/events/{event_id}', response_model=EventInDBVM)
async def getEvent(
    event_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
) -> Event:
    """TODO: Fetch recurring event."""
    event = (
        await session.execute(
            select(Event)
            .where(and_(User.id == user.id, Event.id == event_id))
            .options(selectinload(Event.labels))
        )
    ).scalar()

    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    return event


@router.put('/events/{event_id}', response_model=EventInDBVM)
async def updateEvent(
    event: EventBaseVM,
    event_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Event:
    """Update an existing event. For recurring events, create the "override" event
    in the DB with the composite id of {baseId}_{date}.

    TODO: Handle move between different calendars
    """
    curEvent: Optional[Event] = (
        await session.execute(
            select(Event)
            .where(and_(User.id == user.id, Event.id == event_id))
            .options(selectinload(Event.labels))
            .options(selectinload(Event.calendar))
        )
    ).scalar()

    if curEvent and not curEvent.isWritable():
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail='Can not update event.')

    # Not found in DB.
    elif not curEvent and not event.recurring_event_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Event not found.')

    # This is an instance of a recurring event. Replace the recurring event instance with and override.
    elif not curEvent and event.recurring_event_id:
        parentEvent: Optional[Event] = (
            await session.execute(
                select(Event)
                .where(and_(User.id == user.id, Event.id == event.recurring_event_id))
                .options(selectinload(Event.labels))
                .options(selectinload(Event.calendar))
            )
        ).scalar()

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
        if parentEvent.recurring_event_gId:
            googleId = getRecurringEventId(parentEvent.recurring_event_gId, dt, event.isAllDay())

        prevCalendarId = None

        # Sets the original recurring start date info.
        event.original_start = dt
        event.original_start_day = event.start_day
        event.original_timezone = event.timezone

        eventDb = createOrUpdateEvent(None, event, overrideId=event_id, googleId=googleId)

        user.events.append(eventDb)
        await session.commit()
        await session.refresh(eventDb)

        logger.info(f'Created Override: {eventDb}')

    # We are overriding a parent recurring event.
    elif curEvent and curEvent.is_parent_recurring_event:
        prevCalendarId = curEvent.calendar_id

        # Since we're modifying the recurrence, we need to remove all previous overrides.
        # TODO: Only delete the overrides that no longer exist.
        if curEvent.recurrences != event.recurrences:
            stmt = delete(Event).where(
                and_(Event.user_id == user.id, Event.recurring_event_id == curEvent.id)
            )
            await session.execute(stmt)

        eventDb = createOrUpdateEvent(curEvent, event)

    # Update normal event.
    else:
        prevCalendarId = curEvent.calendar_id if curEvent else None
        eventDb = createOrUpdateEvent(curEvent, event)

    logger.info(f'Updated Event: {eventDb}')

    eventDb.labels.clear()
    eventDb.labels = await getCombinedLabels(user, event.labels, session)

    if eventDb.calendar.google_id:
        if prevCalendarId and prevCalendarId != eventDb.calendar_id:
            # Base recurring Event.
            recurringEvent: Optional[Event] = (
                await session.execute(
                    select(Event)
                    .where(and_(User.id == user.id, Event.id == event.recurring_event_id))
                    .options(selectinload(Event.labels))
                    .options(selectinload(Event.calendar))
                )
            ).scalar()

            if recurringEvent:
                # If we move one event's calendar, we need to update all child events.
                recurringEvent.calendar_id = eventDb.calendar_id

                childEvents: List[Event] = (
                    await session.execute(
                        select(Event).where(
                            and_(User.id == user.id, Event.recurring_event_id == recurringEvent.id)
                        )
                    )
                ).scalars()

                for e in childEvents:
                    e.calendar_id = eventDb.calendar_id

                moveGoogleEvent(user, recurringEvent, prevCalendarId)
            else:
                moveGoogleEvent(user, eventDb, prevCalendarId)

        updateGoogleEvent(user, eventDb)

    await session.commit()

    return eventDb


@router.delete('/events/{eventId}')
async def deleteEvent(
    eventId: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
):
    """Delete an event.
    If the ID does not exist in the DB, it could be a "virtual ID" for a recurring event,
    in which case we'd need to create an override Event to model a deleted event.
    """
    logger.info(f'Delete Event {eventId}')

    stmt = (
        select(Event)
        .where(and_(Event.user_id == user.id, Event.id == eventId, Event.status != 'deleted'))
        .options(selectinload(Event.labels))
    )
    event = (await session.execute(stmt)).scalar()

    if event:
        event.status = 'deleted'

        # If the parent is deleted, we can delete all child event.
        # TODO: Foreign keys?
        stmt = delete(Event).where(
            and_(Event.user_id == user.id, Event.recurring_event_id == event.id)
        )
        await session.execute(stmt)

        # Delete from Google
        if event.g_id:
            try:
                _ = deleteGoogleEvent(user, event)
            except HttpError as e:
                logger.error(e)

        await session.commit()

    else:
        # Virtual recurring event instance.
        try:
            event = await createOverrideDeletedEvent(user, eventId, session)
            user.events.append(event)
            await session.commit()

        except InputError as e:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))

    return {}


async def getCombinedLabels(
    user: User, labelVMs: List[LabelInDbVM], session: AsyncSession
) -> List[Label]:
    """"List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []
    for labelVM in labelVMs:
        # TODO: Bulk Query
        stmt = select(Label).where(and_(User.id == user.id, Label.id == labelVM.id))
        label = (await session.execute(stmt)).scalar()

        if label:
            labels.append(label)

    return combineLabels(labels)


async def createOverrideDeletedEvent(user: User, eventId: str, session: AsyncSession):
    # Override as a deleted event.
    parentEvent, dt = await verifyAndGetRecurringEventParent(user, eventId, session)

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
