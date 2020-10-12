from fastapi import APIRouter, Depends, HTTPException
from starlette.status import HTTP_404_NOT_FOUND
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import User
from app.calendar.google import updateCalendar
from app.core.logger import logger

router = APIRouter()


class CalendarBaseVM(BaseModel):
    summary: str
    description: Optional[str]
    background_color: str = Field(alias='backgroundColor')
    foreground_color: str = Field(alias='foregroundColor')
    selected: Optional[bool]
    primary: Optional[bool]
    access_role: str = Field(alias='accessRole')

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class CalendarVM(CalendarBaseVM):
    id: str


@router.get('/calendars/', response_model=List[CalendarVM])
async def getCalendars(user: User = Depends(get_current_user), session: Session = Depends(get_db)):

    return user.calendars.all()


@router.put('/calendars/{calendarId}', response_model=CalendarVM)
async def putCalendar(calendarId: str,
                      calendar: CalendarVM,
                      user: User = Depends(get_current_user),
                      session: Session = Depends(get_db)):
    calendarDb = user.calendars.filter_by(id=calendar.id).one_or_none()
    if calendarDb:
        calendarDb.selected = calendar.selected
        calendarDb.summary = calendar.summary
        calendarDb.background_color = calendar.background_color
        calendarDb.foreground_color = calendar.foreground_color
        updateCalendar(user, calendarDb)
        session.commit()
    else:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return calendarDb
