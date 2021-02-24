from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_404_NOT_FOUND
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from typing import List, Optional
import shortuuid

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import User, Calendar
from app.db.models.event import isValidTimezone
from app.core.logger import logger

from app.calendar.google import updateCalendar, createCalendar

router = APIRouter()


class CalendarBaseVM(BaseModel):
    summary: str
    description: Optional[str]
    background_color: str = Field(alias='backgroundColor')
    foreground_color: str = Field(alias='foregroundColor')
    selected: Optional[bool]
    primary: Optional[bool]
    isGoogleCalendar: bool = False
    timezone: Optional[str]
    access_role: Optional[str] = Field(alias='accessRole')

    @validator('timezone')
    def validateTimezone(cls, timezone: Optional[str]):
        if timezone:
            if not isValidTimezone(timezone):
                raise ValueError(f'Invalid timezone {timezone}')

        return timezone

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class CalendarVM(CalendarBaseVM):
    id: str


@router.get('/calendars/', response_model=List[CalendarVM])
async def getCalendars(user: User = Depends(get_current_user), session: Session = Depends(get_db)):
    return user.calendars.all()


@router.post('/calendars/', response_model=CalendarVM)
async def postCalendar(
    calendar: CalendarBaseVM,
    user: User = Depends(get_current_user),
):
    isPrimary = calendar.primary or False
    if isPrimary:
        # TODO: Bulk update.
        for cal in user.calendars:
            cal.primary = False

    calendarDb = Calendar(
        shortuuid.uuid(),
        None,
        calendar.summary,
        calendar.description,
        calendar.background_color,
        calendar.foreground_color,
        True,
        'owner',
        isPrimary,
        False,
    )
    user.calendars.append(calendarDb)

    if calendar.isGoogleCalendar:
        resp = createCalendar(user, calendarDb)
        calendarDb.google_id = resp['id']

    return calendarDb


@router.put('/calendars/{calendarId}', response_model=CalendarVM)
async def putCalendar(
    calendarId: str,
    calendar: CalendarVM,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    calendarDb = user.calendars.filter_by(id=calendar.id).one_or_none()
    if calendarDb:
        calendarDb.selected = calendar.selected
        calendarDb.summary = calendar.summary
        calendarDb.background_color = calendar.background_color
        calendarDb.foreground_color = calendar.foreground_color

        if calendarDb.isGoogleCalendar:
            updateCalendar(user, calendarDb)

        session.commit()
    else:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return calendarDb
