from datetime import datetime
from itertools import islice
import logging

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import aliased, selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Optional, Literal, Tuple, Generator, Any, AsyncGenerator

from dateutil.rrule import rrule, rruleset, rrulestr
from datetime import timedelta
from zoneinfo import ZoneInfo

from pydantic import BaseModel, validator
from app.api.endpoints.labels import LabelInDbVM
from app.db.models import Event, User, Calendar
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


class Error(Exception):
    """Base class for exceptions in this module."""

    pass


class InputError(Error):
    """Exception raised for errors in the input."""

    pass


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
    recurrences = None if eventVM.recurring_event_id else eventVM.recurrences

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
            recurrences,
            eventVM.original_start,
            eventVM.original_start_day,
            eventVM.original_timezone,
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
            eventDb.recurrences = recurrences
            eventDb.original_start = eventVM.original_start
            eventDb.original_start_day = eventVM.original_start_day
            eventDb.original_timezone = eventVM.original_timezone

        return eventDb


def getRecurringEventId(baseEventId: str, startDate: datetime, isAllDay: bool) -> str:
    """Returns a composite ID for the recurring event, based on the original
    event ID and the start date.
    """
    dtStr = startDate.astimezone(ZoneInfo('UTC')).strftime(
        "%Y%m%d" if isAllDay else "%Y%m%dT%H%M%SZ"
    )
    return f'{baseEventId}_{dtStr}'


async def getAllExpandedRecurringEventsList(
    user: User, startDate: datetime, endDate: datetime, session
) -> List[EventInDBVM]:
    expandedEvents = [
        i async for i in getAllExpandedRecurringEvents(user, startDate, endDate, session)
    ]

    return sorted(
        expandedEvents,
        key=lambda event: event.start,
    )


async def getAllExpandedRecurringEvents(
    user: User, startDate: datetime, endDate: datetime, session
) -> AsyncGenerator[EventInDBVM, None]:
    """Expands the rule in the event to get all events between the start and end.
    TODO: This expansion is a huge perf bottleneck..
    - Date expansions are CPU bound so we could rewrite the date rrules expansion in a rust binding.
    - Don't need to expand ALL baseRecurringEvents, just ones in between the range.
    - => cache the end dates properties to recurring events on insert / update.

    TODO: Update EXDATE on write so we don't have to manually override events.
    """
    overrides = user.getSingleEventsStmt(showDeleted=True).where(
        Event.recurring_event_id != None,
    )

    # Moved from outside of this time range to within.
    movedFromOutsideOverrides = overrides.where(
        Event.end >= startDate,
        Event.start <= endDate,
        Event.status != 'deleted',
        # Original is outside the current range.
        or_(
            Event.original_start == None,  # TODO: remove None
            and_(
                Event.original_start < startDate,
                Event.original_start > endDate,
            ),
        ),
    )
    result = await session.execute(movedFromOutsideOverrides)
    for eventOverride in result.scalars():
        # print(eventOverride)
        yield EventInDBVM.from_orm(eventOverride)

    # Overrides from within this time range.
    movedFromInsideOverrides = overrides.where(
        or_(
            Event.original_start == None,
            and_(
                Event.original_start >= startDate,
                Event.original_start <= endDate,
            ),
        )
    )

    result = await session.execute(movedFromInsideOverrides)
    eventOverridesMap: Dict[str, Event] = {e.id: e for e in result.scalars()}

    result = await session.execute(
        user.getRecurringEventsStmt()
        .where(Event.start <= endDate)
        .options(selectinload(Event.calendar))
    )
    baseRecurringEvents = result.scalars().all()

    for baseRecurringEvent in baseRecurringEvents:
        for e in getExpandedRecurringEvents(
            user, baseRecurringEvent, eventOverridesMap, startDate, endDate
        ):
            yield e


def getExpandedRecurringEvents(
    user: User,
    baseRecurringEvent: Event,
    eventOverridesMap: Dict[str, Event],
    startDate: datetime,
    endDate: datetime,
) -> Generator[EventInDBVM, None, None]:
    """Precondition: Make sure calendar is joined with the baseRecurringEvent

    For now, assumes that the ruleset composes only of one rrule, and exdates so that
    we can do optimizations like checking for _dtstart and _until.
    """
    duration = baseRecurringEvent.end - baseRecurringEvent.start
    isAllDay = baseRecurringEvent.all_day
    baseEventVM = EventInDBVM.from_orm(baseRecurringEvent)
    calendar = baseRecurringEvent.calendar
    timezone = baseRecurringEvent.time_zone or calendar.timezone or user.timezone

    if not baseEventVM.recurrences:
        logging.error(f'Empty Recurrence: {baseEventVM.id}')

    else:
        ruleSet = recurrenceToRuleSet(
            '\n'.join(baseEventVM.recurrences), timezone, baseEventVM.start, baseEventVM.start_day
        )

        # All day events use naiive dates.
        # Events from google are represented with UTC times, so we need the timezone aware
        # start & end filters. Pretty hacky.
        if isAllDay or (hasattr(ruleSet, '_dtstart') and not ruleSet._dtstart.tzinfo):  # type: ignore
            startDate = startDate.replace(tzinfo=None)
            endDate = endDate.replace(tzinfo=None)
        else:
            zone = baseRecurringEvent.time_zone or calendar.timezone or user.timezone
            startDate = startDate.astimezone(ZoneInfo(zone))
            endDate = endDate.astimezone(ZoneInfo(zone))

        untilIsBeforeStartDate = hasattr(ruleSet, '_until') and ruleSet._until and ruleSet._until < startDate  # type: ignore

        if not untilIsBeforeStartDate:
            # Expand events, inclusive
            dates = ruleSet.between(
                startDate - timedelta(seconds=1), endDate + timedelta(seconds=1)
            )

            for date in islice(dates, MAX_RECURRING_EVENT_COUNT):
                start = date.replace(tzinfo=ZoneInfo(timezone))
                end = start + duration

                eventId = getRecurringEventId(baseEventVM.id, start, isAllDay)

                if eventId in eventOverridesMap:
                    eventOverride = eventOverridesMap[eventId]
                    if eventOverride.status != 'deleted':
                        eventOverride.recurrences = baseRecurringEvent.recurrences
                        eventOverride.original_start = baseRecurringEvent.original_start
                        eventOverride.original_start_day = baseRecurringEvent.original_start_day
                        eventOverride.original_timezone = baseRecurringEvent.original_timezone
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
                            'recurrences': baseRecurringEvent.recurrences,
                        }
                    )


async def verifyAndGetRecurringEventParent(
    user: User, eventId: str, session: AsyncSession
) -> Tuple[Event, datetime]:
    """Returns the parent from the virtual eventId.
    Returns tuple of (parent event, datetime)

    Throws InputError if it's not a valid event ID.
    """
    parts = eventId.split('_')
    if not len(parts) >= 2:
        raise InputError(f'Invalid Event ID: {eventId}')

    parentId = ''.join(parts[:-1])

    stmt = select(Event).where(and_(User.id == user.id, Event.id == parentId))
    parentEvent = (await session.execute(stmt)).scalar()

    if not parentEvent:
        raise InputError(f'Invalid Event ID: {eventId}')

    _, date = verifyRecurringEvent(user, eventId, parentEvent)

    return parentEvent, date


def verifyRecurringEvent(user: User, eventId: str, parentEvent: Event) -> Tuple[str, datetime]:
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

        for e in getExpandedRecurringEvents(user, parentEvent, {}, dt, dt):
            if e.id == eventId:
                return ''.join(parts[:-1]), dt

        raise InputError('Invalid Event ID.')

    except ValueError:
        raise InputError('Invalid Event ID.')
