from datetime import datetime
from itertools import islice
import logging

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, aliased
from typing import List, Dict, Optional, Literal, Tuple, Generator
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
    status: EventStatus = 'active'
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

    original_start_datetime: Optional[datetime]
    original_start_day: Optional[datetime]

    def isAllDay(self) -> bool:
        return self.start_day is not None and self.end_day is not None

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


def recurrenceToRuleSet(
    recurrence: List[str], timezone: str, start: datetime, startDay: Optional[str]
) -> rruleset:
    """Gets the rrule objects from recurrence string array
    Converts to the local datetime in the timezone.
    """
    if not start and not startDay:
        raise InputError('Either until or occurrences must be set.')

    if not recurrence or len(recurrence) == 0:
        raise InputError('Recurrence array must be non-empty.')

    if startDay is not None:
        localDate = datetime.strptime(startDay, "%Y-%m-%d")
        return rrulestr('\n'.join(recurrence), dtstart=localDate, ignoretz=True)
    else:
        localizedDate = start.astimezone(ZoneInfo(timezone))
        return rrulestr('\n'.join(recurrence), dtstart=localizedDate)


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


def createOrUpdateEvent(
    eventDb: Optional[Event],
    eventVM: EventBaseVM,
    overrideId: Optional[str] = None,
    googleId: Optional[str] = None,
) -> Event:
    if not eventDb:
        return Event(
            googleId,
            eventVM.title,
            eventVM.description,
            eventVM.start,
            eventVM.end,
            eventVM.start_day,
            eventVM.end_day,
            eventVM.calendar_id,
            eventVM.timezone,
            eventVM.recurrences,
            status=eventVM.status,
            recurringEventId=eventVM.recurring_event_id,
            overrideId=overrideId,
        )
    else:
        if eventVM.title:
            eventDb.title = eventVM.title
            eventDb.description = eventVM.description
            eventDb.start = eventVM.start
            eventDb.end = eventVM.end
            eventDb.start_day = eventVM.start_day
            eventDb.end_day = eventVM.end_day
            eventDb.calendar_id = eventVM.calendar_id
            eventDb.recurring_event_id = eventVM.recurring_event_id
            eventDb.recurrences = eventVM.recurrences

        return eventDb


def getRecurringEventId(baseEventId: str, startDate: datetime, isAllDay: bool) -> str:
    """Returns a composite ID for the recurring event, based on the original
    event ID and the start date.
    """
    dtStr = startDate.astimezone(ZoneInfo('UTC')).strftime(
        "%Y%m%d" if isAllDay else "%Y%m%dT%H%M%SZ"
    )
    return f'{baseEventId}_{dtStr}'


def getAllExpandedRecurringEvents(
    user: User, startDate: datetime, endDate: datetime, session
) -> Generator[EventInDBVM, None, None]:
    """Expands the rule in the event to get all events between the start and end.
    TODO: Don't need to expand ALL baseRecurringEvents, just ones in between the range.
    TODO: add start & end dates properties to recurring events.
    """
    E1 = aliased(Event)
    eventOverrides = (
        user.getEvents(showDeleted=True)
        .filter(or_(and_(Event.start >= startDate, Event.start <= endDate), Event.start == None))
        .join(Event.recurring_event.of_type(E1))
    )

    eventOverridesMap: Dict[str, Event] = {e.id: e for e in eventOverrides}
    baseRecurringEvents = user.getRecurringEvents()

    for baseRecurringEvent in baseRecurringEvents:
        for e in getExpandedRecurringEvents(
            baseRecurringEvent, eventOverridesMap, startDate, endDate
        ):
            yield e


def getExpandedRecurringEvents(
    baseRecurringEvent: Event,
    eventOverridesMap: Dict[str, Event],
    startDate: datetime,
    endDate: datetime,
) -> Generator[EventInDBVM, None, None]:
    duration = baseRecurringEvent.end - baseRecurringEvent.start
    timezone = baseRecurringEvent.getTimezone()
    isAllDay = baseRecurringEvent.all_day
    baseEventVM = EventInDBVM.from_orm(baseRecurringEvent)

    if not baseEventVM.recurrences:
        logging.error(f'Empty Recurrence: {baseEventVM.id}')

    else:
        ruleSet = recurrenceToRuleSet(
            baseEventVM.recurrences, timezone, baseEventVM.start, baseEventVM.start_day
        )

        # All day events use naiive dates.
        # Events from google are represented with UTC times, so we need the timezone aware
        # start & end filters. Pretty hacky.
        if isAllDay or (hasattr(ruleSet, '_dtstart') and not ruleSet._dtstart.tzinfo):  # type: ignore
            startDate = startDate.replace(tzinfo=None)
            endDate = endDate.replace(tzinfo=None)
        else:
            startDate = startDate.replace(tzinfo=None).astimezone(ZoneInfo('UTC'))
            endDate = endDate.replace(tzinfo=None).astimezone(ZoneInfo('UTC'))

        # Expand events, inclusive
        for date in islice(
            ruleSet.between(startDate - timedelta(seconds=1), endDate + timedelta(seconds=1)),
            MAX_RECURRING_EVENT_COUNT,
        ):
            start = date.replace(tzinfo=ZoneInfo(timezone))
            end = start + duration

            eventId = getRecurringEventId(baseEventVM.id, start, isAllDay)

            if eventId in eventOverridesMap:
                eventOverride = eventOverridesMap[eventId]
                if eventOverride.status != 'deleted':
                    yield EventInDBVM.from_orm(eventOverride)
            else:
                yield baseEventVM.copy(
                    update={
                        'id': eventId,
                        'start': start,
                        'end': end,
                        'start_day': start.strftime('%Y-%m-%d') if isAllDay else None,
                        'end_day': end.strftime('%Y-%m-%d') if isAllDay else None,
                        'recurring_event_id': baseRecurringEvent.id,
                        'recurrences': None,
                    }
                )


def verifyAndGetRecurringEventParent(eventId: str, session: Session) -> Tuple[Event, datetime]:
    """Returns the parent from the virtual eventId.
    Returns tuple of (parent event, datetime)
    """
    parts = eventId.split('_')
    if not len(parts) >= 2:
        raise InputError(f'Invalid Event ID: {eventId}')

    parentId = ''.join(parts[:-1])
    parentEvent = session.query(Event).filter(Event.id == parentId).one_or_none()

    if not parentEvent:
        raise InputError(f'Invalid Event ID: {eventId}')

    _, date = verifyRecurringEvent(eventId, parentEvent)

    return parentEvent, date


def verifyRecurringEvent(eventId: str, parentEvent: Event) -> Tuple[str, datetime]:
    """Makes sure the eventId is part of the parent Event ID.
    Returns tuple of (parent event ID, datetime)
    Raises InputError otherwise.
    """
    parts = eventId.split('_')
    if not len(parts) >= 2:
        raise InputError(f'Invalid Event ID: {eventId}')

    parentEventId = ''.join(parts[:-1])
    if not parentEventId == parentEvent.id:
        raise InputError(f'Invalid Event ID: {eventId} parent {parentEvent.id}')

    datePart = parts[-1]
    try:
        dt = datetime.strptime(datePart, "%Y%m%dT%H%M%SZ")
        for e in getExpandedRecurringEvents(parentEvent, {}, dt, dt):
            if e.id == eventId:
                return ''.join(parts[:-1]), dt

        raise InputError('Invalid Event ID.')

    except ValueError:
        raise InputError('Invalid Event ID.')
