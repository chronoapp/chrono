import shortuuid

from typing import Optional, List
from pydantic import BaseModel, Field, validator

from sqlalchemy import and_, update, delete, select
from sqlalchemy.orm import Session

from app.db.models.event import isValidTimezone
from app.db.models.user_calendar import CalendarSource
from app.db.models import User, UserCalendar, Calendar

from app.api.repos.exceptions import CalendarNotFoundError


class CalendarBaseVM(BaseModel):
    summary: str
    description: Optional[str]
    background_color: str = Field(alias='backgroundColor')
    foreground_color: str = Field(alias='foregroundColor')
    selected: Optional[bool]
    primary: Optional[bool]
    timezone: Optional[str]
    access_role: Optional[str] = Field(alias='accessRole')
    source: CalendarSource
    email: Optional[str]

    @validator('timezone')
    def validateTimezone(cls, timezone: Optional[str]) -> Optional[str]:
        if timezone:
            if not isValidTimezone(timezone):
                raise ValueError(f'Invalid timezone {timezone}')

        return timezone

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class CalendarVM(CalendarBaseVM):
    id: str


class CalendarRepo:
    def __init__(self, session: Session):
        self.session = session

    def getCalendar(self, user: User, calendarId: str) -> UserCalendar:
        userCalendar = (
            self.session.execute(
                select(UserCalendar).where(
                    and_(UserCalendar.user_id == user.id, UserCalendar.id == calendarId)
                )
            )
        ).scalar()

        if not userCalendar:
            raise CalendarNotFoundError('Calendar not found.')

        return userCalendar

    def getCalendars(self, user: User) -> list[UserCalendar]:
        result = self.session.execute(select(UserCalendar).where(UserCalendar.user_id == user.id))
        calendars = result.scalars().all()

        return list(calendars)

    def createCalendar(self, user: User, calendar: CalendarBaseVM) -> UserCalendar:
        isPrimary = calendar.primary or False

        if isPrimary:
            stmt = update(UserCalendar).where(UserCalendar.user_id == user.id).values(primary=False)
            self.session.execute(stmt)

        calendarId = shortuuid.uuid()
        baseCalendar = Calendar(
            calendarId, calendar.summary, calendar.description, calendar.timezone, user.email
        )

        userCalendar = UserCalendar(
            calendarId,
            None,
            calendar.background_color,
            calendar.foreground_color,
            True,
            'owner',
            isPrimary,
            False,
        )
        userCalendar.calendar = baseCalendar
        user.calendars.append(userCalendar)

        return userCalendar

    def updateCalendar(self, user: User, calendarId: str, userCalendar: CalendarVM) -> UserCalendar:
        calendarDb = self.getCalendar(user, calendarId)
        if not calendarDb:
            raise CalendarNotFoundError('Calendar not found.')

        calendarDb.selected = userCalendar.selected or False
        calendarDb.summary_override = userCalendar.summary
        calendarDb.background_color = userCalendar.background_color
        calendarDb.foreground_color = userCalendar.foreground_color

        # TODO: More fields to update.

        return calendarDb

    def deleteCalendar(self, user: User, calendarId: str) -> None:
        calendarDb = self.getCalendar(user, calendarId)

        self.session.execute(delete(UserCalendar).where(UserCalendar.id == calendarDb.id))
        self.session.commit()
