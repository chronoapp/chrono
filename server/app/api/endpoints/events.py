from datetime import datetime, timedelta
from typing import List, Optional, Union, Iterable
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.repos.event_repo import (
    EventRepoError,
    EventRepository,
)
from app.api.repos.calendar_repo import CalendarRepo
from app.api.repos.exceptions import (
    RepoError,
    EventRepoError,
    InputError,
    NotFoundError,
)

from app.api.repos.event_utils import (
    EventBaseVM,
    EventInDBVM,
)
from app.db.models import Event, User

router = APIRouter()


@router.get('/events/', response_model=List[EventInDBVM])
async def getEvents(
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
    TODO: Filter by dates
    """
    eventRepo = EventRepository(session)
    if query:
        tsQuery = ' & '.join(query.split())
        return await eventRepo.search(user.id, tsQuery, limit=limit)
    else:

class MoveCalendarRequest(BaseModel):
    calendar_id: str


@router.get('/calendars/{calendarId}/events/', response_model=List[EventInDBVM])
async def getCalendarEvents(
    calendarId: str,
    limit: int = 250,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Iterable[Union[EventInDBVM, Event]]:
    """Gets all events for a calendar."""
    try:
        startDate = (
            datetime.fromisoformat(start_date)
            if start_date
            else datetime.now() - timedelta(days=30)
        )
        endDate = datetime.fromisoformat(end_date) if end_date else datetime.now()

        eventRepo = EventRepository(session)
        return await eventRepo.getEventsInRange(user, calendarId, startDate, endDate, limit)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid date format: {e}'
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post('/calendars/{calendarId}/events/', response_model=EventInDBVM)
async def createCalendarEvent(
    calendarId: str,
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

        calendarRepo = CalendarRepo(session)
        eventRepo = EventRepository(session)

        calendarDb = await calendarRepo.getCalendar(user, calendarId)
        eventDb = await eventRepo.createEvent(user, calendarDb, event)
        await session.commit()

        return eventDb

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get('/calendars/{calendar_id}/events/{event_id}', response_model=EventInDBVM)
async def getCalendarEvent(
    calendar_id: str,
    event_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Event:
    try:
        eventRepo = EventRepository(session)
        calendarRepo = CalendarRepo(session)

        calendar = await calendarRepo.getCalendar(user, calendar_id)
        event = await eventRepo.getEventVM(user, calendar, event_id)

        if event:
            return event
        else:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put('/calendars/{calendar_id}/events/{event_id}', response_model=EventInDBVM)
async def updateCalendarEvent(
    event: EventBaseVM,
    calendar_id: str,
    event_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Event:
    """Update an existing event. For recurring events, create the "override" event
    in the DB with the composite id of {baseId}_{date}.
    """
    try:
        eventRepo = EventRepository(session)
        calendarRepo = CalendarRepo(session)
        userCalendar = await calendarRepo.getCalendar(user, calendar_id)

        eventDb = await eventRepo.updateEvent(user, userCalendar, event_id, event)
        await session.commit()

        return eventDb

    except InputError as e:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post('/calendars/{calendarId}/events/{eventId}/move', response_model=EventInDBVM)
async def moveEventCalendar(
    calendarId: str,
    eventId: str,
    calReq: MoveCalendarRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Event:
    try:
        eventRepo = EventRepository(session)

        event = await eventRepo.moveEvent(user, eventId, calendarId, calReq.calendar_id)
        await session.commit()

        return event

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete('/calendars/{calendarId}/events/{eventId}')
async def deleteCalendarEvent(
    calendarId: str,
    eventId: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Delete an event.
    If the ID does not exist in the DB, it could be a "virtual ID" for a recurring event,
    in which case we'd need to create an override Event to model a deleted event.
    """
    logger.info(f'Delete Event {eventId}')

    try:
        eventRepo = EventRepository(session)
        calendarRepo = CalendarRepo(session)

        userCalendar = await calendarRepo.getCalendar(user, calendarId)
        _ = await eventRepo.deleteEvent(user, userCalendar, eventId)

        await session.commit()

        return {}

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
