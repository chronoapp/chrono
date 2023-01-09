from typing import Literal, Optional, TYPE_CHECKING

from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship, backref

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
    id: str = Column(String(255), ForeignKey('calendar.id'), primary_key=True)
    calendar: 'Calendar' = relationship(
        "Calendar",
        back_populates="user_calendars",
        uselist=False,
        foreign_keys=[id],
        lazy='joined',
    )

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user: 'User' = relationship(
        'User', backref=backref('calendars', lazy='joined', cascade='all,delete')
    )

    # IDs for google / msft / aapl.
    google_id = Column(String(255), ForeignKey('calendar.google_id'), nullable=True)
    sync_token = Column(String(255))  # TODO: Rename to google_sync_token.

    # User specific properties
    summary_override: Optional[str] = Column(String(255))
    background_color: Optional[str] = Column(String(10))
    foreground_color: Optional[str] = Column(String(10))
    selected: bool = Column(Boolean)
    access_role = Column(String(50))  # AccessRole
    primary = Column(Boolean)
    deleted = Column(Boolean)

    webhook: 'Webhook' = relationship(
        "Webhook", uselist=False, back_populates="calendar", lazy='joined'
    )

    def __repr__(self) -> str:
        return f'<UserCalendar id={self.id} summary={self.summary}/>'

    def __init__(
        self,
        id: str,
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
        self.access_role = access_role
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
