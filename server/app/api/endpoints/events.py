import heapq
from datetime import datetime, timedelta
from typing import List, Optional, Union, Iterable
from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy import asc, and_, select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.repos.event_repo import EventRepository, CalendarNotFound, EventNotFound, getCombinedLabels

from app.api.repos.event_utils import (
    InputError,
    EventBaseVM,
    EventInDBVM,
    createOrUpdateEvent,
    getRecurringEventId,
    verifyRecurringEvent,
)
from app.calendar.google import (
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
        startDate = datetime.fromisoformat(start_date) if start_date else datetime.now() - timedelta(days=30)
        endDate = datetime.fromisoformat(end_date) if end_date else datetime.now()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid date format: {e}')

    eventRepo = EventRepository(session)

    if title:
        return await eventRepo.searchByTitle(user, title, startDate, endDate, limit)

    elif query:
        # TODO: Search in recurring events.
        tsQuery = ' & '.join(query.split())
        return await eventRepo.search(user.id, tsQuery, limit=limit)

    else:
        return await eventRepo.getEventsInRange(user, startDate, endDate, limit)


@router.post('/events/', response_model=EventInDBVM)
async def createEvent(
    event: EventBaseVM,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Event:
    try:
        if event.recurring_event_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Can not modify recurring event from this endpoint.',
            )

        eventRepo = EventRepository(session)
        eventDb = await eventRepo.createEvent(user, event)
        await session.commit()

        return eventDb

    except CalendarNotFound:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail='Calendar not found.')
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST)


@router.get('/events/{event_id}', response_model=EventInDBVM)
async def getEvent(
    event_id: str, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
) -> Event:
    """TODO: Fetch recurring event."""
    eventRepo = EventRepository(session)

    event = await eventRepo.getEvent(event_id, user)
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
    eventRepo = EventRepository(session)
    curEvent = await eventRepo.getEvent(user, event_id)

    if curEvent and not curEvent.isWritable():
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail='Can not update event.')

    # Not found in DB.
    elif not curEvent and not event.recurring_event_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Event not found.')

    # This is an instance of a recurring event. Replace the recurring event instance with and override.
    elif not curEvent and event.recurring_event_id:
        parentEvent = await eventRepo.getEvent(user, event.recurring_event_id)

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

        _ = updateGoogleEvent(user, eventDb)

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

    try:
        eventRepo = EventRepository(session)
        _ = await eventRepo.delete(user, eventId)
        await session.commit()

        return {}

    except EventNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Event not found.')
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST)
