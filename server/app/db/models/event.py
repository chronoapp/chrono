import re
import uuid
import shortuuid

from enum import Enum
from datetime import datetime
from typing import Optional, List, Literal, TYPE_CHECKING, Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import (
    Boolean,
    String,
    ForeignKey,
    Text,
    DateTime,
    ARRAY,
    UniqueConstraint,
    ForeignKeyConstraint,
    UUID,
    Enum as SQLAlchemyEnum,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column, backref

from app.db.base_class import Base
from app.db.models.event_label import event_label_association_table
from app.db.models.user_calendar import UserCalendar

if TYPE_CHECKING:
    from .calendar import Calendar
    from .label import Label
    from .event_participant import EventAttendee, EventCreator, EventOrganizer
    from .conference_data import ConferenceData
    from .reminder import ReminderOverride


EventStatus = Literal['deleted', 'tentative', 'active']

# Title that has extra entities like Contact.
TAGGED_INPUT_PATTERN = r'@\[([\w\d.\-\_\@ ]+)\]\(\[id:([\w-]+)\]\[type:([\w]+)\]\)'


def stripParticipants(title: Optional[str]) -> Optional[str]:
    if title:
        return re.sub(TAGGED_INPUT_PATTERN, r'\1', title)
    else:
        return None


def isValidTimezone(timeZone: str) -> bool:
    try:
        ZoneInfo(timeZone)
        return True
    except ZoneInfoNotFoundError:
        return False


class Transparency(Enum):
    OPAQUE = 'opaque'  # busy
    TRANSPARENT = 'transparent'  # free


class Visibility(Enum):
    DEFAULT = 'default'
    PUBLIC = 'public'
    PRIVATE = 'private'
    CONFIDENTIAL = 'confidential'


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
    uid = mapped_column(UUID, primary_key=True, default=uuid.uuid4, nullable=False)

    """This ID could be duplicated to multiple calendars, so it's not a primary key.
    """
    id: Mapped[str] = mapped_column(String, default=shortuuid.uuid, nullable=False, index=True)

    # Google-specific
    google_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)

    calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID(),
        ForeignKey('calendar.id', name='event_calendar_id_fk'),
    )
    calendar: Mapped['Calendar'] = relationship('Calendar', back_populates='events')

    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text())
    status: Mapped[str] = mapped_column(String(20), server_default='active')
    location: Mapped[Optional[str]] = mapped_column(Text())

    start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # TODO: Validate these fields.
    start_day: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True
    )  # YYYY-MM-DD date if full day

    end_day: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True
    )  # YYYY-MM-DD date if full day

    time_zone: Mapped[Optional[str]] = mapped_column(String(255))

    labels: Mapped[list['Label']] = relationship(
        'Label',
        lazy='joined',
        secondary=event_label_association_table,
        cascade="all,delete",
    )

    participants: Mapped[list['EventAttendee']] = relationship(
        "EventAttendee",
        lazy='joined',
        cascade="all, delete-orphan",
        backref=backref('event', lazy='joined'),
        foreign_keys='[EventParticipant.event_uid]',
    )

    # The calendar / user who created this Event.
    creator_id = mapped_column(
        UUID,
        ForeignKey('event_participant.id', name='event_creator_fk', use_alter=True),
        nullable=True,
    )
    creator: Mapped[Optional['EventCreator']] = relationship(
        'EventCreator',
        lazy='joined',
        uselist=False,
        backref=backref('event', uselist=False, lazy='joined'),
        foreign_keys=[creator_id],
    )

    # The calendar / user who currently owns this Event.
    organizer_id = mapped_column(
        UUID,
        ForeignKey('event_participant.id', name='event_organizer_fk', use_alter=True),
        nullable=True,
    )
    organizer: Mapped[Optional['EventOrganizer']] = relationship(
        'EventOrganizer',
        lazy='joined',
        uselist=False,
        backref=backref('event', uselist=False, lazy='joined'),
        foreign_keys=[organizer_id],
    )

    # Recurring Events.
    recurrences: Mapped[Optional[List[Any]]] = mapped_column(ARRAY(String), nullable=True)
    recurring_event_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    recurring_event_calendar_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID, nullable=True, index=True
    )

    # Original time (For recurring events). Child event use the parent's value.
    original_start = mapped_column(DateTime(timezone=True))
    original_start_day = mapped_column(String(10))
    original_timezone = mapped_column(String(255))

    # Guest permissions
    guests_can_modify: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    guests_can_invite_others: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    guests_can_see_other_guests: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Conferencing
    conference_data: Mapped[Optional['ConferenceData']] = relationship(
        "ConferenceData",
        lazy='joined',
        uselist=False,
        back_populates="event",
        cascade="all,delete",
    )

    transparency: Mapped[Transparency] = mapped_column(
        SQLAlchemyEnum(Transparency, name='transparency_enum'), default=Transparency.OPAQUE
    )
    visibility: Mapped[Visibility] = mapped_column(
        SQLAlchemyEnum(Visibility, name='visibility_enum'), default=Visibility.DEFAULT
    )

    reminders: Mapped[list['ReminderOverride']] = relationship(
        "ReminderOverride",
        lazy='joined',
        cascade="all, delete-orphan",
    )

    @property
    def title_short(self) -> Optional[str]:
        return stripParticipants(self.title)

    @property
    def all_day(self) -> bool:
        return self.start_day is not None and self.end_day is not None

    @property
    def is_parent_recurring_event(self) -> bool:
        return self.recurrences is not None and len(self.recurrences) > 0

    @property
    def recurring_event_gId(self) -> Optional[str]:
        if self.is_parent_recurring_event and self.google_id:
            parts = self.google_id.split('_')
            return ''.join(parts[:-1]) if len(parts) >= 2 else self.google_id
        else:
            return self.google_id

    def __init__(
        self,
        googleId: Optional[str],
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
        creator: Optional['EventCreator'],
        organizer: Optional['EventOrganizer'],
        guestsCanModify: Optional[bool],
        guestsCanInviteOthers: Optional[bool],
        guestsCanSeeOtherGuests: Optional[bool],
        conferenceData: Optional['ConferenceData'],
        location: Optional[str],
        transparency: Transparency | None = None,
        visibility: Visibility | None = None,
        overrideId: Optional[str] = None,
        status: EventStatus = 'active',
        recurringEventId: Optional[str] = None,
        recurringEventCalendarId: Optional[uuid.UUID] = None,
    ):
        if overrideId:
            self.id = overrideId

        self.google_id = googleId
        self.title = title or ''
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
        self.conference_data = conferenceData
        self.location = location

        if transparency:
            self.transparency = transparency
        else:
            self.transparency = Transparency.OPAQUE

        if visibility:
            self.visibility = visibility
        else:
            self.visibility = Visibility.DEFAULT

        if guestsCanModify is not None:
            self.guests_can_modify = guestsCanModify
        else:
            self.guests_can_modify = False

        if guestsCanInviteOthers is not None:
            self.guests_can_invite_others = guestsCanInviteOthers
        else:
            self.guests_can_invite_others = True

        if guestsCanSeeOtherGuests is not None:
            self.guests_can_see_other_guests = guestsCanSeeOtherGuests
        else:
            self.guests_can_see_other_guests = True

        self.original_start = originalStart
        self.original_start_day = originalStartDay
        self.original_timezone = originalTimezone

    def __repr__(self) -> str:
        return f'<Event {self.id} {self.title} start:{self.start} end:{self.end} {self.status}/>'

    def isOrganizer(self, userCalendar: UserCalendar) -> bool:
        """Checks if the calendar is the organizer of this event."""
        return self.organizer is not None and (
            self.organizer.email == userCalendar.email
            or self.organizer.email == userCalendar.user.email
        )

    def isGoogleEvent(self) -> bool:
        return self.google_id is not None
