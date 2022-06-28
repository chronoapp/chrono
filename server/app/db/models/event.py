import re
import shortuuid

from datetime import datetime
from typing import Optional, List, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import (
    Column,
    String,
    ForeignKey,
    Text,
    DateTime,
    ARRAY,
    UniqueConstraint,
    ForeignKeyConstraint,
)
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base
from app.db.models.event_label import event_label_association_table
from app.db.models.event_participant import EventParticipant


EventStatus = Literal['deleted', 'tentative', 'active']

# Title that has extra entities like Contact.
TAGGED_INPUT_PATTERN = r'@\[([\w\d\.\-\_ \@]+)\]\(\[id:([\w]+)\]\[type:([\w]+)\]\)'


def stripParticipants(title: Optional[str]):
    if title:
        return re.sub(TAGGED_INPUT_PATTERN, r'\1', title)
    else:
        return None


def isValidTimezone(timeZone: str):
    try:
        ZoneInfo(timeZone)
        return True
    except ZoneInfoNotFoundError:
        return False


class Event(Base):
    """
    Cloned in attendee's calendar after inviting them to the event.
    Changes to the organizer calendar are propagated to attendee copies.
    """

    __tablename__ = 'event'
    __table_args__ = (
        UniqueConstraint('id', 'calendar_id', name='uix_calendar_event_id'),
        ForeignKeyConstraint(
            ['recurring_event_id', 'recurring_event_calendar_id'],
            ['event.id', 'event.calendar_id'],
            name='fk_recurring_event_id_calendar_id',
        ),
    )

    """This is the Internal primary key, used so that references to this event only
    require a single id (rather than a combination of calendar_id and id).
    """
    pk = Column(String, primary_key=True, default=shortuuid.uuid, nullable=False)

    id = Column(String, default=shortuuid.uuid, nullable=False, index=True)
    calendar_id = Column(
        String(255),
        ForeignKey('calendar.id', name='event_calendar_id_fk'),
    )
    calendar = relationship(
        'Calendar',
        backref=backref(
            'events', lazy='dynamic', cascade='all,delete', order_by='Event.start.asc()'
        ),
    )

    # Google-specific
    g_id = Column(String(255), index=True)

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
        foreign_keys='[EventParticipant.event_pk]',
    )

    # The calendar / user who created this Event.
    creator_id = Column(
        String(255),
        ForeignKey('event_participant.id', name='event_creator_fk', use_alter=True),
        nullable=True,
    )
    creator = relationship(
        'EventParticipant',
        lazy='joined',
        uselist=False,
        foreign_keys=[creator_id],
        primaryjoin="EventParticipant.id==Event.creator_id",
    )

    # The calendar / user who currently owns this Event.
    organizer_id = Column(
        String(255),
        ForeignKey('event_participant.id', name='event_organizer_fk', use_alter=True),
        nullable=True,
    )
    organizer = relationship(
        'EventParticipant',
        lazy='joined',
        uselist=False,
        foreign_keys=[organizer_id],
        primaryjoin="EventParticipant.id==Event.organizer_id",
    )

    # Recurring Events.
    recurrences = Column(ARRAY(String), nullable=True)
    recurring_event_id = Column(String, nullable=True, index=True)
    recurring_event_calendar_id = Column(String, nullable=True, index=True)

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
        creator: Optional[EventParticipant],
        organizer: Optional[EventParticipant],
        overrideId: Optional[str] = None,
        status: EventStatus = 'active',
        recurringEventId: Optional[str] = None,
        recurringEventCalendarId: Optional[str] = None,
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
        self.recurring_event_calendar_id = recurringEventCalendarId
        self.status = status
        self.creator = creator
        self.organizer = organizer

        self.original_start = originalStart
        self.original_start_day = originalStartDay
        self.original_timezone = originalTimezone

    def __repr__(self):
        return f'<Event {self.id} {self.title} start:{self.start} end:{self.end} {self.status}/>'
