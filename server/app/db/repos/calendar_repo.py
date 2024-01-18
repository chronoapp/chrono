import uuid

from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

from sqlalchemy import and_, update, delete, select
from sqlalchemy.orm import Session, selectinload

from app.db.models.event import isValidTimezone
from app.db.models.user_calendar import CalendarSource
from app.db.models import User, UserCalendar, Calendar

from app.db.repos.exceptions import CalendarNotFoundError
from app.db.repos.event_repo.view_models import ReminderOverrideVM


class CalendarBaseVM(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    google_id: str | None = None
    summary: str
    summary_override: str | None = Field(alias='summaryOverride')
    description: str | None = None
    background_color: str = Field(alias='backgroundColor')
    foreground_color: str = Field(alias='foregroundColor')
    selected: bool | None = None
    primary: bool | None = None
    timezone: str | None = None
    access_role: str | None = Field(default=None, alias='accessRole')
    source: CalendarSource
    email: str | None = None
    reminders: list[ReminderOverrideVM] = []

    @field_validator('timezone')
    def validateTimezone(cls, timezone: Optional[str]) -> Optional[str]:
        if timezone:
            if not isValidTimezone(timezone):
                raise ValueError(f'Invalid timezone {timezone}')

        return timezone


class CalendarVM(CalendarBaseVM):
    id: uuid.UUID


class CalendarRepository:
    def __init__(self, session: Session):
        self.session = session

    def getPrimaryCalendar(self, userId: uuid.UUID) -> UserCalendar:
        userCalendar = (
            self.session.execute(
                select(UserCalendar).where(
                    UserCalendar.user_id == userId, UserCalendar.primary == True
                )
            )
        ).scalar()

        if not userCalendar:
            raise CalendarNotFoundError('Calendar not found.')

        return userCalendar

    def getCalendar(self, user: User, calendarId: uuid.UUID) -> UserCalendar:
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
        result = self.session.execute(
            select(UserCalendar)
            .where(UserCalendar.user_id == user.id)
            .options(selectinload(UserCalendar.reminders))
        )
        calendars = result.scalars().all()

        return list(calendars)

    def createCalendar(self, user: User, calendar: CalendarBaseVM) -> UserCalendar:
        isPrimary = calendar.primary or False

        if isPrimary:
            stmt = update(UserCalendar).where(UserCalendar.user_id == user.id).values(primary=False)
            self.session.execute(stmt)

        calendarId = uuid.uuid4()
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
            [],
        )
        userCalendar.calendar = baseCalendar
        user.calendars.append(userCalendar)

        return userCalendar

    def updateCalendar(
        self, user: User, calendarId: uuid.UUID, userCalendar: CalendarVM
    ) -> UserCalendar:
        calendarDb = self.getCalendar(user, calendarId)
        if not calendarDb:
            raise CalendarNotFoundError('Calendar not found.')

        calendarDb.selected = userCalendar.selected or False
        calendarDb.summary_override = userCalendar.summary_override
        calendarDb.background_color = userCalendar.background_color
        calendarDb.foreground_color = userCalendar.foreground_color

        # TODO: Depending on ACL, Update the original calendar details on google

        return calendarDb

    def deleteCalendar(self, user: User, calendarId: uuid.UUID) -> None:
        calendarDb = self.getCalendar(user, calendarId)

        self.session.execute(delete(UserCalendar).where(UserCalendar.id == calendarDb.id))
        self.session.commit()
