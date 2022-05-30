import shortuuid

from typing import Optional, List
from pydantic import BaseModel, Field, validator

from sqlalchemy import and_, update, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

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


class CalendarRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def getCalendar(self, user: User, calendarId: str) -> UserCalendar:
        userCalendar = (
            await self.session.execute(
                select(UserCalendar).where(
                    and_(UserCalendar.user_id == user.id, UserCalendar.id == calendarId)
                )
            )
        ).scalar()

        if not userCalendar:
            raise CalendarNotFoundError('Calendar not found.')

        return userCalendar

    async def getCalendars(self, user: User) -> List[UserCalendar]:
        result = await self.session.execute(
            select(UserCalendar).where(UserCalendar.user_id == user.id)
        )
        calendars = result.scalars().all()

        return calendars

    async def createCalendar(self, user: User, calendar: CalendarBaseVM) -> UserCalendar:
        isPrimary = calendar.primary or False

        if isPrimary:
            stmt = update(UserCalendar).where(UserCalendar.user_id == user.id).values(primary=False)
            await self.session.execute(stmt)

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

    async def updateCalendar(
        self, user: User, calendarId: str, userCalendar: CalendarVM
    ) -> UserCalendar:
        calendarDb = await self.getCalendar(user, calendarId)

        if calendarDb:
            calendarDb.selected = userCalendar.selected
            calendarDb.summary_override = userCalendar.summary
            calendarDb.background_color = userCalendar.background_color
            calendarDb.foreground_color = userCalendar.foreground_color

            # TODO: More fields to update.
        else:
            return None

        return calendarDb

    async def deleteCalendar(self, user: User, calendarId: str):
        calendarDb = await self.getCalendar(user, calendarId)

        await self.session.execute(delete(UserCalendar).where(UserCalendar.id == calendarDb.id))
        await self.session.commit()
