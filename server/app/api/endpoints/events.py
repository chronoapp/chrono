from datetime import datetime, timedelta
from typing import List, Optional, Union, Iterable
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.repos.event_repo import EventRepository, CalendarNotFound, EventNotFound, InputError
from app.api.repos.event_utils import (
    EventBaseVM,
    EventInDBVM,
)
from app.db.models import Event, User

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
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Calendar not found.')
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
    try:
        eventRepo = EventRepository(session)
        eventDb = await eventRepo.updateEvent(user, event_id, event)
        await session.commit()

        return eventDb

    except EventNotFound as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except InputError as e:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        print(e)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        _ = await eventRepo.deleteEvent(user, eventId)
        await session.commit()

        return {}

    except EventNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail='Event not found.')
    except Exception as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST)
