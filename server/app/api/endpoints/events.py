import uuid
import shortuuid

from datetime import datetime, timedelta
from typing import List, Optional, Union, Iterable
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.logger import logger
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.repos.event_repo.event_repo import EventRepository

from app.db.repos.calendar_repo import CalendarRepository
from app.db.repos.event_repo.view_models import EventBaseVM
from app.db.repos.exceptions import (
    RepoError,
    EventRepoError,
    InputError,
    NotFoundError,
)

from app.db.repos.event_repo.view_models import (
    EventInDBVM,
)
from app.db.models import Event, User
from app.sync.google.gcal import SendUpdateType

from app.sync.google.tasks import (
    syncEventToGoogleTask,
    syncMoveGoogleEventCalendarTask,
    syncDeleteEventToGoogleTask,
)


START_OF_TIME = datetime(1970, 1, 1, 0, 0, 0)

router = APIRouter()


@router.get('/events/', response_model=List[EventInDBVM])
async def searchEvents(
    query: str = "",
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    TODO: Filter queries for recurring events
    TODO: Figure out how to gather async queries
    TODO: Filter by dates
    """
    try:
        eventRepo = EventRepository(user, session)
        start = datetime.fromisoformat(start_date) if start_date else START_OF_TIME
        end = datetime.fromisoformat(end_date) if end_date else datetime.now() + timedelta(days=365)

        if query:
            tsQuery = ' | '.join(query.split())
            events = eventRepo.search(tsQuery, start, end, limit=limit)

            return events
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail='Search term cannot be empty.'
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid date format: {e}'
        )


class MoveCalendarRequest(BaseModel):
    calendar_id: uuid.UUID


@router.get('/calendars/{calendarId}/events/', response_model=List[EventInDBVM])
async def getCalendarEvents(
    calendarId: uuid.UUID,
    limit: int = 250,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Iterable[Union[EventInDBVM, Event]]:
    """Gets all events for a calendar."""
    try:
        startDate = (
            datetime.fromisoformat(start_date)
            if start_date
            else datetime.now() - timedelta(days=30)
        )
        endDate = datetime.fromisoformat(end_date) if end_date else datetime.now()

        eventRepo = EventRepository(user, session)
        return eventRepo.getEventsInRange(calendarId, startDate, endDate, limit)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f'Invalid date format: {e}'
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post('/calendars/{calendarId}/events/', response_model=EventInDBVM)
async def createCalendarEvent(
    calendarId: uuid.UUID,
    event: EventBaseVM,
    sendUpdateType: SendUpdateType = 'none',
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Event:
    # TODO: Add the default organizer.
    if event.recurring_event_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Can not modify recurring event from this endpoint.',
        )

    if not isValidEventId(event.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail='Event id must be a valid UUID.',
        )

    try:
        calendarRepo = CalendarRepository(session)
        eventRepo = EventRepository(user, session)

        userCalendar = calendarRepo.getCalendar(user, calendarId)
        eventDb = eventRepo.createEvent(userCalendar, event)

        # Sync with google calendar.
        if userCalendar.source == 'google':
            syncEventToGoogleTask.send(user.id, userCalendar.id, eventDb.id, sendUpdateType)

        return eventDb

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get('/calendars/{calendarId}/events/{eventId}', response_model=EventInDBVM)
async def getCalendarEvent(
    calendarId: uuid.UUID,
    eventId: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> EventInDBVM:
    try:
        eventRepo = EventRepository(user, session)
        calendarRepo = CalendarRepository(session)

        calendar = calendarRepo.getCalendar(user, calendarId)
        event = eventRepo.getEventVM(calendar, eventId)

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


@router.put('/calendars/{calendarId}/events/{eventId}', response_model=EventInDBVM)
async def updateCalendarEvent(
    event: EventBaseVM,
    calendarId: uuid.UUID,
    eventId: str,
    sendUpdateType: SendUpdateType = 'none',
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Event:
    """Update an existing event. For recurring events, create the "override" event
    in the DB with the composite id of {baseId}_{date}.
    """
    try:
        eventRepo = EventRepository(user, session)
        calendarRepo = CalendarRepository(session)

        userCalendar = calendarRepo.getCalendar(user, calendarId)
        updatedEvent = eventRepo.updateEvent(userCalendar, eventId, event)

        if userCalendar.source == 'google' and updatedEvent.isGoogleEvent():
            syncEventToGoogleTask.send(user.id, userCalendar.id, updatedEvent.id, sendUpdateType)

        return updatedEvent

    except InputError as e:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post('/calendars/{calendarId}/events/{eventId}/move', response_model=EventInDBVM)
async def moveEventCalendar(
    calendarId: uuid.UUID,
    eventId: str,
    calReq: MoveCalendarRequest,
    sendUpdateType: SendUpdateType = 'none',
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Event:
    try:
        eventRepo = EventRepository(user, session)
        event = eventRepo.moveEvent(eventId, calendarId, calReq.calendar_id)

        # Makes sure both are google calendars.
        if event.isGoogleEvent():
            syncMoveGoogleEventCalendarTask.send(
                user.id, event.google_id, calendarId, calReq.calendar_id, sendUpdateType
            )

        return event

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete('/calendars/{calendarId}/events/{eventId}')
async def deleteCalendarEvent(
    calendarId: uuid.UUID,
    eventId: str,
    sendUpdateType: SendUpdateType = 'none',
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete an event.
    If the ID does not exist in the DB, it could be a "virtual ID" for a recurring event,
    in which case we'd need to create an override Event to model a deleted event.
    """

    try:
        eventRepo = EventRepository(user, session)
        calendarRepo = CalendarRepository(session)

        userCalendar = calendarRepo.getCalendar(user, calendarId)
        event = eventRepo.deleteEvent(userCalendar, eventId)

        if event.isGoogleEvent():
            syncDeleteEventToGoogleTask.send(user.id, userCalendar.id, event.id, sendUpdateType)

        return {}

    except NotFoundError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(e))
    except EventRepoError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


def isValidEventId(id: str | None) -> bool:
    if not id:
        return True
    try:
        shortuuid.decode(id)
        return True
    except:
        return False
