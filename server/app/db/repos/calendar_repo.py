import uuid

from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

from sqlalchemy import and_, update, delete, select
from sqlalchemy.orm import Session, selectinload

from app.db.models.event import isValidTimezone
from app.db.models.user_calendar import CalendarSource
from app.db.models import User, UserCalendar, Calendar, UserAccount

from app.db.repos.exceptions import CalendarNotFoundError
from app.db.repos.event_repo.view_models import ReminderOverrideVM


class CalendarBaseVM(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    account_id: uuid.UUID
    google_id: str | None = None
    summary: str
    summary_override: str | None = Field(default=None, alias='summaryOverride')
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
    """Handles all calendar-related database operations.

    TODO: Use Account instead of User, since a User can have multiple accounts.
    """

    def __init__(self, session: Session):
        self.session = session

    def getPrimaryCalendar(self, userId: uuid.UUID) -> UserCalendar:
        userCalendar = (
            self.session.execute(
                select(UserCalendar)
                .join(UserCalendar.account)
                .where(UserAccount.user_id == userId, UserCalendar.primary == True)
            )
        ).scalar()

        if not userCalendar:
            raise CalendarNotFoundError('Calendar not found.')

        return userCalendar

    def getCalendar(self, user: User, calendarId: uuid.UUID) -> UserCalendar:
        userCalendar = (
            self.session.execute(
                select(UserCalendar)
                .join(UserCalendar.account)
                .where(UserAccount.user_id == user.id, UserCalendar.id == calendarId)
            )
        ).scalar()

        if not userCalendar:
            raise CalendarNotFoundError('Calendar not found.')

        return userCalendar

    def getCalendars(self, user: User) -> list[UserCalendar]:
        result = self.session.execute(
            select(UserCalendar)
            .join(UserCalendar.account)
            .where(UserAccount.user_id == user.id)
            .options(selectinload(UserCalendar.reminders))
        )
        calendars = result.scalars().all()

        return list(calendars)

    def createCalendar(self, account: UserAccount, calendar: CalendarBaseVM) -> UserCalendar:
        isPrimary = calendar.primary or False

        if isPrimary:
            stmt = (
                update(UserCalendar)
                .where(UserCalendar.account_id == account.id)
                .values(primary=False)
            )
            self.session.execute(stmt)

        calendarId = uuid.uuid4()
        baseCalendar = Calendar(
            calendarId, calendar.summary, calendar.description, calendar.timezone, account.email
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
        userCalendar.user = account.user
        userCalendar.account = account

        return userCalendar

    def updateCalendar(
        self, user: User, calendarId: uuid.UUID, userCalendar: CalendarVM
    ) -> UserCalendar:
        """Updates the calendar details and returns the updated calendar.
        If the calendar is not writable, it will only update the summary override.

        The summary update will always be CalendarVM.summary. If the calendar is writable,
        we update the summary field, otherwise we update the summary_override field.
        """
        calendarDb = self.getCalendar(user, calendarId)
        if not calendarDb:
            raise CalendarNotFoundError('Calendar not found.')

        # Updates for the user's calendar list.
        calendarDb.selected = userCalendar.selected or False
        calendarDb.background_color = userCalendar.background_color
        calendarDb.foreground_color = userCalendar.foreground_color
        calendarDb.summary_override = userCalendar.summary

        if calendarDb.hasWriteAccess():
            calendarDb.calendar.summary = userCalendar.summary
            calendarDb.calendar.description = userCalendar.description

        return calendarDb

    def removeUserCalendar(self, user: User, calendarId: uuid.UUID) -> None:
        """Removes the UserCalendar from the user's calendar list.

        Events will still remain in the original calendar list until the original calendar is deleted.
        """
        calendarDb = self.getCalendar(user, calendarId)
        self.session.delete(calendarDb)
