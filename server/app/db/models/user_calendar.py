import uuid
from typing import Literal, Optional, TYPE_CHECKING

from sqlalchemy import Integer, String, ForeignKey, Boolean, UUID
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.db.base_class import Base
from app.db.models.access_control import AccessRole

if TYPE_CHECKING:
    from app.db.models import User, Webhook, Calendar

CalendarSource = Literal['google', 'chrono']

"""A calendar that is linked to the user.
Contains user-specific properties like color and notification settings.
"""


class UserCalendar(Base):
    """TODO: id should not be the same as the calendar id."""

    __tablename__ = 'user_calendar'
    id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('calendar.id'), primary_key=True)

    calendar: Mapped['Calendar'] = relationship(
        "Calendar",
        back_populates="user_calendars",
        uselist=False,
        foreign_keys=[id],
        lazy='joined',
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('user.id'), nullable=False)
    user: Mapped['User'] = relationship('User', back_populates='calendars')

    # IDs for google / msft / aapl.
    google_id = mapped_column(String(255), nullable=True, index=True)
    sync_token = mapped_column(String(255))  # TODO: Rename to google_sync_token.

    # User specific properties
    summary_override: Mapped[Optional[str]] = mapped_column(String(255))
    background_color: Mapped[Optional[str]] = mapped_column(String(10))
    foreground_color: Mapped[Optional[str]] = mapped_column(String(10))
    selected: Mapped[bool] = mapped_column(Boolean)
    access_role = mapped_column(String(50))  # AccessRole
    primary = mapped_column(Boolean)
    deleted = mapped_column(Boolean)

    webhook: Mapped['Webhook'] = relationship(
        "Webhook", uselist=False, back_populates="calendar", lazy='joined'
    )

    def __repr__(self) -> str:
        return f'<UserCalendar id={self.id} summary={self.summary}/>'

    def __init__(
        self,
        id: uuid.UUID,
        summary_override: Optional[str],
        background_color: Optional[str],
        foreground_color: Optional[str],
        selected: bool,
        access_role: AccessRole,
        primary: bool,
        deleted: bool,
    ):
        self.id = id
        self.summary_override = summary_override
        self.background_color = background_color
        self.foreground_color = foreground_color
        self.selected = selected
        self.access_role = str(access_role)
        self.primary = primary
        self.deleted = deleted

    def hasWriteAccess(self) -> bool:
        return self.access_role == 'writer' or self.access_role == 'owner'

    @property
    def summary(self):
        return self.summary_override if self.summary_override else self.calendar.summary

    @property
    def timezone(self):
        return self.calendar.timezone

    @property
    def description(self):
        return self.calendar.description

    @property
    def source(self) -> CalendarSource:
        if self.google_id:
            return 'google'
        else:
            return 'chrono'

    @property
    def email(self):
        return self.calendar.email
