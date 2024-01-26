from typing import Optional, TYPE_CHECKING
import uuid

from sqlalchemy import String, Text, UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.db.base_class import Base

if TYPE_CHECKING:
    from .user_calendar import UserCalendar
    from .event import Event
    from .access_control import AccessControlRule


"""This is the base calendar that is attached to an Event.
Every event many-1 relationship to this calendar.
"""


class Calendar(Base):
    __tablename__ = 'calendar'

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)

    google_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    summary: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text())
    timezone: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user_calendars: Mapped[list['UserCalendar']] = relationship(
        "UserCalendar", foreign_keys='[UserCalendar.id]', cascade='all,delete'
    )
    events: Mapped[list['Event']] = relationship(
        "Event",
        lazy='dynamic',
        cascade='all,delete',
        order_by='Event.start.asc()',
        back_populates='calendar',
    )
    access_control_rules: Mapped[list['AccessControlRule']] = relationship(
        "AccessControlRule",
        back_populates='calendar',
        lazy='dynamic',
        cascade='all,delete',
    )

    @property
    def email(self) -> Optional[str]:
        if self.google_id:
            return self.google_id
        else:
            return self.email_

    def __init__(
        self,
        id: uuid.UUID,
        summary: Optional[str],
        description: Optional[str],
        timezone: Optional[str],
        email: Optional[str],
    ):
        self.id = id
        self.summary = summary
        self.description = description
        self.timezone = timezone
        self.email_ = email

    def __repr__(self) -> str:
        return f'<Calendar id={self.id} summary={self.summary}/>'
