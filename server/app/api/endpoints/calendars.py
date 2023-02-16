import logging
from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_404_NOT_FOUND
from sqlalchemy.orm import Session

from typing import List

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.db.models.user import User
from app.db.models.user_calendar import CalendarSource
from app.db.repos.calendar_repo import (
    CalendarRepo,
    CalendarBaseVM,
    CalendarVM,
    CalendarNotFoundError,
)
from app.sync.google.tasks import updateCalendarTask
from app.sync.google import gcal

router = APIRouter()


@router.get('/calendars/{calendarId}', response_model=CalendarVM)
async def getCalendar(
    calendarId: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    calendarRepo = CalendarRepo(session)

    try:
        userCalendar = calendarRepo.getCalendar(user, calendarId)
        return userCalendar

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)


@router.get('/calendars/', response_model=List[CalendarVM])
async def getCalendars(user: User = Depends(get_current_user), session: Session = Depends(get_db)):
    calendarRepo = CalendarRepo(session)
    calendars = calendarRepo.getCalendars(user)

    return calendars


@router.post('/calendars/', response_model=CalendarVM)
async def postCalendar(
    calendar: CalendarBaseVM,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    calendarRepo = CalendarRepo(session)
    userCalendar = calendarRepo.createCalendar(user, calendar)

    if calendar.source == 'google':
        resp = gcal.createCalendar(user, userCalendar)
        userCalendar.google_id = resp['id']
    else:
        userCalendar.calendar.email_ = user.email

    session.commit()

    return userCalendar


@router.put('/calendars/{calendarId}', response_model=CalendarVM)
async def putCalendar(
    calendarId: str,
    calendar: CalendarVM,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    calendarRepo = CalendarRepo(session)

    try:
        userCalendar = calendarRepo.updateCalendar(user, calendarId, calendar)
        session.commit()

        if userCalendar.source == 'google':
            updateCalendarTask.send(user.id, userCalendar.id)

        return userCalendar

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)


@router.delete('/calendars/{calendarId}')
async def deleteCalendar(
    calendarId: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    try:
        calendarRepo = CalendarRepo(session)
        calendarRepo.deleteCalendar(user, calendarId)

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return {}
