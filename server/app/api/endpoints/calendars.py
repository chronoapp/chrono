import uuid

from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_404_NOT_FOUND
from sqlalchemy.orm import Session

from typing import List

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.db.models.user import User
from app.db.repos.calendar_repo import (
    CalendarRepository,
    CalendarBaseVM,
    CalendarVM,
    CalendarNotFoundError,
)
from app.sync.google.tasks import updateCalendarTask
from app.sync.google import gcal
from app.sync.google.calendar import syncCalendar

router = APIRouter()


@router.get('/calendars/{calendarId}', response_model=CalendarVM)
async def getCalendar(
    calendarId: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    calendarRepo = CalendarRepository(session)

    try:
        userCalendar = calendarRepo.getCalendar(user, calendarId)
        return userCalendar

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)


@router.get('/calendars/', response_model=List[CalendarVM])
async def getCalendars(user: User = Depends(get_current_user), session: Session = Depends(get_db)):
    calendarRepo = CalendarRepository(session)
    calendars = calendarRepo.getCalendars(user)

    return calendars


@router.post('/calendars/', response_model=CalendarVM)
async def createCalendar(
    calendar: CalendarBaseVM,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Creates a new calendar.
    TODO: Add user-defined params (color, primary, etc) so we don't have to sync to get them.
    """
    calendarRepo = CalendarRepository(session)
    userCalendar = calendarRepo.createCalendar(user, calendar)

    if calendar.source == 'google':
        resp = gcal.createCalendar(user, userCalendar.calendar)
        googleId = resp['id']
        userCalendar.google_id = googleId
        userCalendar.calendar.google_id = googleId
        syncCalendar(user, googleId, session)

    else:
        userCalendar.calendar.email_ = user.email

    session.commit()

    return userCalendar


@router.put('/calendars/{calendarId}', response_model=CalendarVM)
async def putCalendar(
    calendarId: uuid.UUID,
    calendar: CalendarVM,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    calendarRepo = CalendarRepository(session)

    try:
        userCalendar = calendarRepo.updateCalendar(user, calendarId, calendar)
        session.commit()

        if userCalendar.source == 'google':
            updateCalendarTask.send(user.id, userCalendar.id)

        return userCalendar

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)


@router.delete('/calendars/{calendarId}')
async def removeUserCalendar(
    calendarId: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Removes from the user's list of calendars."""
    try:
        calendarRepo = CalendarRepository(session)

        userCalendar = calendarRepo.getCalendar(user, calendarId)
        if userCalendar.source == 'google':
            gcal.removeUserCalendar(user, userCalendar)

        calendarRepo.removeUserCalendar(user, calendarId)
        session.commit()

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return {}
