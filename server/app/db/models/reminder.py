import uuid
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, ForeignKey, UUID, Enum as SQLAlchemyEnum
from sqlalchemy.orm import relationship, mapped_column, Mapped

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.db.models import UserCalendar, Event


class ReminderMethod(Enum):
    EMAIL = 'email'
    POPUP = 'popup'
    SMS = 'sms'


class ReminderOverride(Base):
    __tablename__ = 'reminder_override'

    id: Mapped[UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)

    event_uid: Mapped[UUID] = mapped_column(
        UUID, ForeignKey('event.uid'), nullable=True, index=True
    )
    event: Mapped[Optional['Event']] = relationship(
        'Event', back_populates='reminders', foreign_keys=[event_uid]
    )

    user_calendar_id: Mapped[UUID] = mapped_column(
        UUID, ForeignKey('user_calendar.id'), nullable=True, index=True
    )
    user_calendar: Mapped[Optional['UserCalendar']] = relationship(
        'UserCalendar', back_populates='reminders', foreign_keys=[user_calendar_id]
    )

    method: Mapped[ReminderMethod] = mapped_column(
        SQLAlchemyEnum(ReminderMethod, name='reminder_method')
    )
    minutes: Mapped[int] = mapped_column(String(255), nullable=False)

    def __init__(self, method: ReminderMethod, minutes: int):
        self.method = method
        self.minutes = minutes

    def __repr__(self) -> str:
        return f'<ReminderOverride method={self.method} minutes={self.minutes}/>'
