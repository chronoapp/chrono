import re
import shortuuid

from datetime import datetime
from typing import Optional, List, Literal, TYPE_CHECKING
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Table,
    Text,
    DateTime,
    ARRAY,
)
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.db.models import UserCalendar, Calendar


EventStatus = Literal['deleted', 'tentative', 'active']

# Title that has extra entities like Contact.
TAGGED_INPUT_PATTERN = r'@\[([\w\d\.\-\_ \@]+)\]\(\[id:([\w]+)\]\[type:([\w]+)\]\)'


def stripParticipants(title: str):
    return re.sub(TAGGED_INPUT_PATTERN, r'\1', title)


def isValidTimezone(timeZone: str):
    try:
        ZoneInfo(timeZone)
        return True
    except ZoneInfoNotFoundError:
        return False


event_label_association_table = Table(
    'event_label',
    Base.metadata,
    Column('event_id', String, ForeignKey('event.id', ondelete='CASCADE')),
    Column('label_id', Integer, ForeignKey('label.id', ondelete='CASCADE')),
)


class EventCalendar(Base):
    __tablename__ = 'event_calendar'
    event_id = Column(String, ForeignKey('event.id', ondelete='CASCADE'), primary_key=True)
    calendar_id = Column(String, ForeignKey('calendar.id', ondelete='CASCADE'), primary_key=True)

    event = relationship("Event", back_populates="calendars")
    calendar = relationship("Calendar", back_populates="events")


class Event(Base):
    """Recurring events are modelled as an adjacency list."""

    __tablename__ = 'event'
    id = Column(String, primary_key=True, default=shortuuid.uuid, nullable=False)

    # Google-specific
    g_id = Column(String(255), unique=True)

    # TODO: Remove reference to user
    user_id = Column(Integer, ForeignKey('user.id', ondelete='SET NULL'), nullable=True)
    user = relationship('User', backref=backref('events', lazy='dynamic'))

    calendars = relationship(
        'EventCalendar',
        lazy='dynamic',
        cascade="all,delete",
        back_populates="event",
    )

    title = Column(String(255), index=True)
    description = Column(Text())
    status = Column(String(20), server_default='active')

    start = Column(DateTime(timezone=True), nullable=True)
    end = Column(DateTime(timezone=True), nullable=True)

    # TODO: Validate these fields.
    start_day = Column(String(10), nullable=True)  # YYYY-MM-DD date if full day
    end_day = Column(String(10), nullable=True)  # YYYY-MM-DD date if full day
    time_zone = Column(String(255))

    labels = relationship(
        'Label',
        lazy='joined',
        secondary=event_label_association_table,
        cascade="all,delete",
    )

    participants = relationship(
        "EventParticipant",
        lazy='joined',
        cascade="all, delete-orphan",
    )

    # Recurring Events.
    recurrences = Column(ARRAY(String), nullable=True)
    recurring_event_id = Column(String, ForeignKey('event.id'), nullable=True, index=True)
    recurring_event = relationship("Event", remote_side=[id], backref='recurring_events')

    # Original time (For recurring events). Child event use the parent's value.
    original_start = Column(DateTime(timezone=True))
    original_start_day = Column(String(10))
    original_timezone = Column(String(255))

    @property
    def title_short(self):
        return stripParticipants(self.title)

    @property
    def all_day(self):
        return self.start_day is not None and self.end_day is not None

    @property
    def is_parent_recurring_event(self) -> bool:
        return self.recurrences is not None and len(self.recurrences) > 0

    @property
    def recurring_event_gId(self) -> Optional[str]:
        if self.is_parent_recurring_event and self.g_id:
            parts = self.g_id.split('_')
            return ''.join(parts[:-1]) if len(parts) >= 2 else self.g_id
        else:
            return self.g_id

    def __init__(
        self,
        g_id: Optional[str],
        title: Optional[str],
        description: Optional[str],
        start: Optional[datetime],
        end: Optional[datetime],
        start_day: Optional[str],
        end_day: Optional[str],
        timezone: Optional[str],
        recurrences: Optional[List[str]],
        originalStart: Optional[datetime],
        originalStartDay: Optional[str],
        originalTimezone: Optional[str],
        overrideId: Optional[str] = None,
        status: EventStatus = 'active',
        recurringEventId: Optional[str] = None,
    ):
        if overrideId:
            self.id = overrideId

        self.g_id = g_id
        self.title = title
        self.description = description
        self.start = start
        self.end = end
        self.start_day = start_day
        self.end_day = end_day
        self.time_zone = timezone
        self.recurrences = recurrences
        self.recurring_event_id = recurringEventId
        self.status = status

        self.original_start = originalStart
        self.original_start_day = originalStartDay
        self.original_timezone = originalTimezone

    def __repr__(self):
        return f'<Event {self.id} {self.title} start:{self.start} end:{self.end} {self.status}/>'

    def isWritable(self) -> bool:
        return self.calendar.access_role == 'writer' or self.calendar.access_role == 'owner'
