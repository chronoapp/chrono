from datetime import datetime

from typing import List, Dict, Optional, Literal, Any

from dateutil.rrule import rrule, rruleset, rrulestr
from zoneinfo import ZoneInfo

from pydantic import BaseModel, validator
from app.api.endpoints.labels import LabelInDbVM
from app.db.models import Event, EventParticipant, UserCalendar
from app.db.models.event import EventStatus
from app.db.models.event_participant import ResponseStatus

"""Event models and helpers to manage Recurring Events.
"""


class EventParticipantVM(BaseModel):
    """Either one of email or contact ID is required."""

    id: Optional[str]
    contact_id: Optional[str]
    email: Optional[str]

    response_status: Optional[ResponseStatus] = 'needsAction'
    display_name: Optional[str]
    photo_url: Optional[str]

    @validator("email")
    def validateContactAndEmail(cls, email, values: Dict[str, Any]):
        if email is None and values.get("contact_id") is None:
            raise ValueError("Either email or contact_id is required.")

        return email

    class Config:
        orm_mode = True


class EventBaseVM(BaseModel):
    """Viewmodel for events.
    TODO: If we have start_day and end_day, we don't need start and end.
    """

    title: Optional[str]
    title_short: Optional[str]

    description: Optional[str] = None
    status: EventStatus = 'active'
    start: datetime
    end: datetime
    start_day: Optional[str]
    end_day: Optional[str]

    labels: List[LabelInDbVM] = []
    all_day: Optional[bool]
    background_color: Optional[str]
    timezone: Optional[str]
    calendar_id: Optional[str]
    recurrences: Optional[List[str]]
    recurring_event_id: Optional[str]

    participants: List[EventParticipantVM] = []
    creator: Optional[EventParticipantVM]
    organizer: Optional[EventParticipantVM]

    # Read only fields.
    original_start: Optional[datetime]
    original_start_day: Optional[str]
    original_timezone: Optional[str]

    @validator('recurrences')
    def isValidRecurrence(cls, recurrences: Optional[List[str]], values: Dict[str, Any]):
        """Makes sure the start and end dates aren't included in the recurrence, since they
        the event itself has these fields.
        """
        if recurrences and len(recurrences) > 0 and 'start' in values:
            recurrenceString = '\n'.join(recurrences)
            if 'DTSTART' in recurrenceString or 'DTEND' in recurrenceString:
                raise ValueError('Recurrence should not have DTSTART or DTEND')

            recurrenceToRuleSet(
                recurrenceString, values['timezone'] or 'UTC', values['start'], values['start_day']
            )

        return recurrences

    def isAllDay(self) -> bool:
        return self.start_day is not None and self.end_day is not None

    class Config:
        orm_mode = True


class EventInDBVM(EventBaseVM):
    id: str


MAX_RECURRING_EVENT_COUNT = 1000

UpdateOption = Literal['SINGLE', 'ALL', 'FOLLOWING']


def recurrenceToRuleSet(
    recurrence: str, timezone: str, start: datetime, startDay: Optional[str]
) -> rruleset:
    """Gets the rrule objects from recurrence string array
    Converts to the local datetime in the timezone.
    """
    if not start and not startDay:
        raise ValueError('Either until or occurrences must be set.')

    if recurrence == '':
        raise ValueError('Recurrences must be non-empty.')

    if startDay is not None:
        localDate = datetime.strptime(startDay, "%Y-%m-%d")
        return rrulestr(recurrence, dtstart=localDate, ignoretz=True)
    else:
        localizedDate = start.astimezone(ZoneInfo(timezone))
        return rrulestr(recurrence, dtstart=localizedDate)


def getRRule(
    startDate: Optional[datetime],
    freq: int,
    interval: int,
    occurrences: Optional[int],
    until: Optional[datetime],
) -> rrule:
    if until and occurrences:
        raise ValueError('Until and occurrences cannot both be set.')
    if not until and not occurrences:
        raise ValueError('Either until or occurrences must be set.')

    count = None
    if not until:
        count = (
            min(MAX_RECURRING_EVENT_COUNT, occurrences)
            if occurrences
            else MAX_RECURRING_EVENT_COUNT
        )

    if count:
        rule = rrule(dtstart=startDate, freq=freq, interval=interval, count=count)
    else:
        rule = rrule(dtstart=startDate, freq=freq, interval=interval, until=until)

    return rule


def createOrUpdateEvent(
    userCalendar: UserCalendar,
    eventDb: Optional[Event],
    eventVM: EventBaseVM,
    overrideId: Optional[str] = None,
    googleId: Optional[str] = None,
) -> Event:
    recurrences = None if eventVM.recurring_event_id else eventVM.recurrences
    creator = (
        EventParticipant(eventVM.creator.email, eventVM.creator.display_name, None)
        if eventVM.creator
        else None
    )
    organizer = (
        EventParticipant(eventVM.organizer.email, eventVM.organizer.display_name, None)
        if eventVM.organizer
        else None
    )

    if not eventDb:
        event = Event(
            googleId,
            eventVM.title,
            eventVM.description,
            eventVM.start,
            eventVM.end,
            eventVM.start_day,
            eventVM.end_day,
            eventVM.timezone,
            recurrences,
            eventVM.original_start,
            eventVM.original_start_day,
            eventVM.original_timezone,
            creator,
            organizer,
            status=eventVM.status,
            recurringEventId=eventVM.recurring_event_id,
            recurringEventCalendarId=userCalendar.id,
            overrideId=overrideId,
        )
        userCalendar.calendar.events.append(event)

        return event
    else:
        eventDb.title = eventVM.title or eventDb.title
        eventDb.description = eventVM.description or eventDb.description
        eventDb.start = eventVM.start or eventDb.start
        eventDb.end = eventVM.end or eventDb.end
        eventDb.start_day = eventVM.start_day or eventDb.start_day
        eventDb.end_day = eventVM.end_day or eventDb.end_day
        eventDb.time_zone = eventVM.timezone
        eventDb.recurring_event_id = eventVM.recurring_event_id or eventDb.recurring_event_id
        eventDb.recurring_event_calendar_id = userCalendar.id
        eventDb.recurrences = recurrences or eventDb.recurrences
        if not eventDb.creator:
            eventDb.creator = creator
        eventDb.organizer = organizer

        return eventDb


def getRecurringEventId(baseEventId: str, startDate: datetime, isAllDay: bool) -> str:
    """Returns a composite ID for the recurring event, based on the original
    event ID and the start date.
    """
    dtStr = startDate.astimezone(ZoneInfo('UTC')).strftime(
        "%Y%m%d" if isAllDay else "%Y%m%dT%H%M%SZ"
    )
    return f'{baseEventId}_{dtStr}'
