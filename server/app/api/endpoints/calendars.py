from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_404_NOT_FOUND
from sqlalchemy.ext.asyncio import AsyncSession

from typing import List

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.db.models.user import User
from app.db.models.user_calendar import CalendarSource
from app.api.repos.calendar_repo import (
    CalendarRepo,
    CalendarBaseVM,
    CalendarVM,
    CalendarNotFoundError,
)
from app.sync.google import gcal

router = APIRouter()


@router.get('/calendars/{calendarId}', response_model=CalendarVM)
async def getCalendar(
    calendarId: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    calendarRepo = CalendarRepo(session)

    try:
        userCalendar = await calendarRepo.getCalendar(user, calendarId)
        return userCalendar

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)


@router.get('/calendars/', response_model=List[CalendarVM])
async def getCalendars(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
):
    calendarRepo = CalendarRepo(session)
    calendars = await calendarRepo.getCalendars(user)

    return calendars


@router.post('/calendars/', response_model=CalendarVM)
async def postCalendar(
    calendar: CalendarBaseVM,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    calendarRepo = CalendarRepo(session)
    userCalendar = await calendarRepo.createCalendar(user, calendar)

    if calendar.source == 'google':
        resp = gcal.createCalendar(user, userCalendar)
        userCalendar.google_id = resp['id']

    await session.commit()

    return userCalendar


@router.put('/calendars/{calendarId}', response_model=CalendarVM)
async def putCalendar(
    calendarId: str,
    calendar: CalendarVM,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    calendarRepo = CalendarRepo(session)

    try:
        userCalendar = await calendarRepo.updateCalendar(user, calendarId, calendar)

        if userCalendar.source == 'google':
            gcal.updateCalendar(user, userCalendar)

        await session.commit()
        return userCalendar

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)


@router.delete('/calendars/{calendarId}')
async def deleteCalendar(
    calendarId: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    try:
        calendarRepo = CalendarRepo(session)
        await calendarRepo.deleteCalendar(user, calendarId)

    except CalendarNotFoundError:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return {}
