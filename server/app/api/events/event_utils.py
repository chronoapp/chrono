from datetime import datetime
from itertools import islice

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from typing import List, Optional, Literal, Tuple, Generator
from dateutil.rrule import rrule, rruleset, rrulestr
from datetime import timedelta
from backports.zoneinfo import ZoneInfo

from pydantic import BaseModel
from app.api.endpoints.labels import LabelInDbVM
from app.db.models import Event, User
from app.db.models.event import EventStatus

"""Event models and helpers to manage Recurring Events.
"""


class EventBaseVM(BaseModel):
    """Viewmodel for events.
    TODO: If we have start_day and end_day, we don't need start and end.
    """

    title: Optional[str]
    description: Optional[str] = None
    status: Optional[EventStatus] = 'active'
    start: datetime
    end: datetime
    start_day: Optional[str]
    end_day: Optional[str]

    labels: List[LabelInDbVM] = []
    all_day: Optional[bool]
    background_color: Optional[str]
    timezone: Optional[str]
    calendar_id: str
    recurrences: Optional[List[str]]
    recurring_event_id: Optional[str]

    def isAllDay(self) -> Optional[bool]:
        return self.start_day is not None and self.end_day is not None

    def getRRules(self, timeZone: str) -> List[rrule]:
        """Gets the rrule objects from recurrence string array."""
        if not self.recurrences:
            return []

        if self.isAllDay() and self.start_day is not None:
            localDate = datetime.strptime(self.start_day, "%Y-%m-%d")
        else:
            localDate = self.start.astimezone(ZoneInfo(timeZone)).replace(tzinfo=None)

        return [rrulestr(r, dtstart=localDate, ignoretz=True) for r in self.recurrences]

    class Config:
        orm_mode = True


class EventInDBVM(EventBaseVM):
    id: str


MAX_RECURRING_EVENT_COUNT = 1000

UpdateOption = Literal['SINGLE', 'ALL', 'FOLLOWING']


class Error(Exception):
    """Base class for exceptions in this module."""

    pass


class InputError(Error):
    """Exception raised for errors in the input."""

    pass


def convertToLocalTime(dateTime: datetime, timeZone: str):
    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware


def getRRule(
    startDate: datetime,
    freq: int,
    interval: int,
    occurrences: Optional[int],
    until: Optional[datetime],
) -> rrule:
    if until and occurrences:
        raise InputError('Until and occurrences cannot both be set.')
    if not until and not occurrences:
        raise InputError('Either until or occurrences must be set.')

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


def createRecurringEvents(
    user: User, rules: List[rrule], event: EventBaseVM, timezone: str
) -> Tuple[Event, List[Event]]:
    """Creates all recurring events with this rule. We create one "virtual" base event,
    and concrete events with a reference to the base event.
    """
    duration = event.end - event.start

    # Base event.
    recurringEvent = Event(
        None,
        event.title,
        event.description,
        event.start,
        event.end,
        event.start_day,
        event.end_day,
        event.calendar_id,
        timezone,
        [str(r) for r in rules],
        copyOriginalStart=True,
    )
    user.events.append(recurringEvent)

    ruleSet = rruleset()
    for r in rules:
        ruleSet.rrule(r)

    isAllDay = event.isAllDay()
    events = []
    for date in islice(ruleSet, MAX_RECURRING_EVENT_COUNT):
        start = date.replace(tzinfo=ZoneInfo(timezone))
        end = start + duration

        event = Event(
            None,
            event.title,
            event.description,
            start,
            end,
            start.strftime('%Y-%m-%d') if isAllDay else None,
            end.strftime('%Y-%m-%d') if isAllDay else None,
            event.calendar_id,
            timezone,
            None,
            copyOriginalStart=True,
        )
        event.recurring_event = recurringEvent
        user.events.append(event)
        events.append(event)

    return recurringEvent, events


def updateRecurringEvent(
    user: User, event: Event, updateEvent: EventBaseVM, updateOption: UpdateOption, session: Session
):
    """Bulk updates for recurring events."""
    if updateOption == 'SINGLE':
        createOrUpdateEvent(event, updateEvent)

    elif updateOption == 'ALL':
        if event.is_parent_recurring_event:
            baseEvent = event
        else:
            baseEvent = user.events.filter(Event.id == event.recurring_event_id).one_or_none()

        # normalize datetime to the base event.
        startDiff = updateEvent.start - event.original_start
        duration = updateEvent.end - updateEvent.start
        newStart = baseEvent.original_start + startDiff

        if baseEvent:
            updateRecurringEvent(
                user,
                baseEvent,
                updateEvent.copy(update={'start': newStart, 'end': newStart + duration}),
                'FOLLOWING',
                session,
            )

    elif updateOption == 'FOLLOWING':
        # Alternatively, create a new Recurring event with a different RRULE.
        if event.is_parent_recurring_event:
            followingEvents = user.events.filter(
                and_(
                    or_(Event.recurring_event_id == event.id, Event.id == event.id),
                    Event.start >= event.start,
                )
            )
        else:
            followingEvents = user.events.filter(
                and_(
                    Event.recurring_event_id == event.recurring_event_id, Event.start >= event.start
                )
            )

        # Shift from the original time.
        startDiff = updateEvent.start - event.original_start
        duration = updateEvent.end - updateEvent.start
        for e in followingEvents:
            newStart = e.original_start + startDiff
            createOrUpdateEvent(
                e, updateEvent.copy(update={'start': newStart, 'end': newStart + duration})
            )
    else:
        raise InputError(f'updateOption must be {UpdateOption}')


def deleteRecurringEvent(user: User, event: Event, updateOption: UpdateOption, session: Session):
    if updateOption == 'SINGLE':
        if event.is_parent_recurring_event:
            deleteRecurringEvent(user, event, 'ALL', session)
        else:
            session.delete(event)

    elif updateOption == 'ALL':
        if event.is_parent_recurring_event:
            user.events.filter(Event.recurring_event_id == event.id).delete()
            session.delete(event)
        elif event.recurring_event_id:
            user.events.filter(Event.recurring_event_id == event.recurring_event_id).delete()
            user.events.filter(Event.id == event.recurring_event_id).delete()

    elif updateOption == 'FOLLOWING':
        # TODO: Could update the recurrence instead.
        if event.is_parent_recurring_event:
            deleteRecurringEvent(user, event, 'ALL', session)

        if event.recurring_event_id:
            user.events.filter(
                and_(
                    Event.recurring_event_id == event.recurring_event_id, Event.start >= event.start
                )
            ).delete()

    else:
        raise InputError(f'updateOption must be {UpdateOption}')


def createOrUpdateEvent(
    eventDb: Optional[Event], event: EventBaseVM
) -> Tuple[Event, Optional[str]]:
    prevCalendarId = None
    if not eventDb:
        eventDb = Event(
            None,
            event.title,
            event.description,
            event.start,
            event.end,
            event.start_day,
            event.end_day,
            event.calendar_id,
            event.timezone,
        )
    else:
        if event.title:
            eventDb.title = event.title
            eventDb.description = event.description
            eventDb.start = event.start
            eventDb.end = event.end
            eventDb.start_day = event.start_day
            eventDb.end_day = event.end_day
            prevCalendarId = eventDb.calendar_id
            eventDb.calendar_id = event.calendar_id
            # TODO: Update other fields

    return eventDb, prevCalendarId