import heapq
from typing import List, Optional, Iterable, Tuple, Generator, AsyncGenerator, Dict
from datetime import datetime
from googleapiclient.errors import HttpError
from zoneinfo import ZoneInfo
from itertools import islice
from datetime import timedelta
import logging

from sqlalchemy import asc, and_, select, delete, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import exists

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, desc

from app.core.logger import logger
from app.db.sql.event_search import EVENT_SEARCH_QUERY
from app.db.models import Event, User, UserCalendar, Calendar, EventParticipant
from app.db.models.event import EventCalendar
from app.api.repos.contact_repo import ContactRepository
from app.api.repos.calendar_repo import CalendarRepo
from app.api.repos.event_utils import (
    EventBaseVM,
    EventInDBVM,
    EventParticipantVM,
    createOrUpdateEvent,
    getRecurringEventId,
    recurrenceToRuleSet,
)

import app.sync.google.gcal as gcal

from app.api.endpoints.labels import LabelInDbVM, Label, combineLabels
from app.api.repos.exceptions import EventRepoError, InputError, EventNotFoundError, RepoError


MAX_RECURRING_EVENT_COUNT = 1000


def getBaseEventsStmt():
    return (
        select(Event)
        .options(selectinload(Event.participants))
        .options(selectinload(Event.labels))
        .join(Event.calendars)
        .join(EventCalendar.calendar)
        .join(Calendar.user_calendars)
        .join(User)
    )


class EventRepository:
    """
    Combination of a Service / Repository over events.
    Provides an abstraction over SQLAlchemy.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def isMember(self, calendarId: str, eventId: str):
        existsQuery = select(exists(EventCalendar)).where(
            EventCalendar.event_id == eventId,
            EventCalendar.calendar_id == calendarId,
        )

        return (await self.session.execute(existsQuery)).scalar()

    async def getRecurringEvents(self, user: User, calendarId: str, endDate: datetime):
        stmt = (
            getBaseEventsStmt()
            .where(User.id == user.id)
            .filter(
                and_(
                    Event.recurrences != None,
                    Event.recurring_event_id == None,
                    Event.status != 'deleted',
                )
            )
            .where(Event.start <= endDate, UserCalendar.id == calendarId)
        )

        result = await self.session.execute(stmt)

        return result.scalars().all()

    async def getSingleEvents(self, user: User, calendarId: str, showRecurring=True):
        """Gets all events for the calendar."""
        stmt = getBaseEventsStmt().where(and_(User.id == user.id, Calendar.id == calendarId))

        if not showRecurring:
            stmt = stmt.filter(Event.recurring_event_id == None)

        result = await self.session.execute(stmt)
        singleEvents = result.scalars().all()

        return singleEvents

    async def getEventsInRange(
        self, user: User, calendarId: str, startDate: datetime, endDate: datetime, limit: int
    ) -> Iterable[EventInDBVM]:
        calendarRepo = CalendarRepo(self.session)
        calendar = await calendarRepo.getCalendar(user, calendarId)

        singleEventsStmt = (
            getBaseEventsStmt()
            .where(
                User.id == user.id,
                UserCalendar.id == calendarId,
                Event.recurrences == None,
                Event.recurring_event_id == None,
                Event.end >= startDate,
                Event.start <= endDate,
                Event.status != 'deleted',
            )
            .order_by(asc(Event.start))
            .limit(limit)
        )
        result = await self.session.execute(singleEventsStmt)
        singleEvents = result.scalars().all()

        expandedRecurringEvents = await getAllExpandedRecurringEventsList(
            user, calendar, startDate, endDate, self.session
        )

        allEvents = heapq.merge(
            expandedRecurringEvents, singleEvents, key=lambda event: event.start
        )

        return allEvents

    async def getGoogleEvent(self, user: User, googleEventId: str) -> Optional[Event]:
        stmt = getBaseEventsStmt().where(User.id == user.id, Event.g_id == googleEventId)
        result = await self.session.execute(stmt)

        return result.scalar()

    async def getEvent(self, user: User, calendar: UserCalendar, eventId: str) -> Optional[Event]:
        """Gets an event that exists in the DB only."""
        curEvent: Optional[Event] = (
            await self.session.execute(
                getBaseEventsStmt().where(
                    User.id == user.id, Calendar.id == calendar.id, Event.id == eventId
                )
            )
        ).scalar()

        return curEvent

    async def getEventVM(
        self, user: User, calendar: UserCalendar, eventId: str
    ) -> Optional[EventInDBVM]:
        """Gets the event view model, which includes instances of recurring events."""
        eventInDB = await self.getEvent(user, calendar, eventId)

        if eventInDB:
            return EventInDBVM.from_orm(eventInDB)
        else:
            # Check if it's a virtual event within a recurrence.
            event, _ = await getRecurringEventWithParent(calendar, eventId, self.session)

            return event

    async def createEvent(
        self, user: User, userCalendar: UserCalendar, event: EventBaseVM
    ) -> Event:
        if not userCalendar.canWriteEvent():
            raise EventRepoError("Can not update event with this calendar.")

        # Keeps track of the "Original" time this recurrence should have started.
        if event.recurrences or event.recurring_event_id:
            event.original_start = event.start
            event.original_start_day = event.start_day
            event.original_timezone = event.timezone

        eventDb = createOrUpdateEvent(None, event)

        # Attach event to calendar
        ec = EventCalendar()
        ec.event = eventDb
        userCalendar.calendar.events.append(ec)

        eventDb.labels = await getCombinedLabels(user, event.labels, self.session)
        await self.updateEventParticipants(user, eventDb, event.participants)

        # Sync with google calendar. TODO: Add flag for sync status
        if userCalendar.source == 'google':
            resp = gcal.insertGoogleEvent(userCalendar, eventDb)
            eventDb.g_id = resp.get('id')

        return eventDb

    async def deleteEvent(self, user: User, userCalendar: UserCalendar, eventId: str) -> Event:
        """
        DONOTSHIP: Make it so it updates the status the calendar -> event mapping.
        """
        if not userCalendar.canWriteEvent():
            raise RepoError('User cannot write event.')

        event = await self.getEvent(user, userCalendar, eventId)

        if event:
            event.status = 'deleted'

            # If the parent is deleted, we can delete all child event.
            # TODO: Foreign keys?
            stmt = delete(Event).where(
                and_(Event.user_id == user.id, Event.recurring_event_id == event.id)
            )
            await self.session.execute(stmt)

            # Delete from Google
            if event.g_id:
                try:
                    _ = gcal.deleteGoogleEvent(user, userCalendar, event)
                except HttpError as e:
                    logger.error(e)

        else:
            # Virtual recurring event instance.
            try:
                event = await createOverrideDeletedEvent(userCalendar, eventId, self.session)

                ec = EventCalendar()
                ec.event = event
                userCalendar.calendar.events.append(ec)

            except InputError as e:
                raise EventNotFoundError('Event not found.')

    async def updateEvent(
        self, user: User, userCalendar: UserCalendar, eventId: str, event: EventBaseVM
    ) -> Event:
        curEvent = await self.getEvent(user, userCalendar, eventId)

        if curEvent and not userCalendar.canWriteEvent():
            raise EventRepoError("Can not update event with this calendar.")

        # Not found in DB.
        elif not curEvent and not event.recurring_event_id:
            raise EventNotFoundError(f'Event not found.')

        # This is an instance of a recurring event. Replace the recurring event instance with and override.
        elif not curEvent and event.recurring_event_id:
            parentEvent = await self.getEvent(user, userCalendar, event.recurring_event_id)

            if not parentEvent:
                raise EventNotFoundError(f'Invalid parent event {event.recurring_event_id}.')

            try:
                eventVM = getRecurringEvent(userCalendar, eventId, parentEvent)
            except InputError as err:
                raise EventNotFoundError(str(err))

            dt = eventVM.original_start
            googleId = None
            if parentEvent.recurring_event_gId:
                googleId = getRecurringEventId(
                    parentEvent.recurring_event_gId, dt, event.isAllDay()
                )

            # Sets the original recurring start date info.
            event.original_start = dt
            event.original_start_day = event.start_day
            event.original_timezone = event.timezone

            updatedEvent = createOrUpdateEvent(None, event, overrideId=eventId, googleId=googleId)
            ec = EventCalendar()
            ec.event = updatedEvent
            userCalendar.calendar.events.append(ec)

            await self.session.commit()
            await self.session.refresh(updatedEvent)

            logger.info(f'Created Override: {updatedEvent}')

        # We are overriding a parent recurring event.
        elif curEvent and curEvent.is_parent_recurring_event:
            # Since we're modifying the recurrence, we need to remove all previous overrides.
            # TODO: Only delete the overrides that no longer exist.
            if curEvent.recurrences != event.recurrences:
                stmt = delete(Event).where(
                    and_(Event.user_id == user.id, Event.recurring_event_id == curEvent.id)
                )
                await self.session.execute(stmt)

            updatedEvent = createOrUpdateEvent(curEvent, event)

        # Update normal event.
        else:
            updatedEvent = createOrUpdateEvent(curEvent, event)

        logger.info(f'Updated Event: {updatedEvent}')
        updatedEvent.labels.clear()
        updatedEvent.labels = await getCombinedLabels(user, event.labels, self.session)

        await self.updateEventParticipants(user, updatedEvent, event.participants)

        if updatedEvent.g_id:
            gcal.updateGoogleEvent(userCalendar, updatedEvent)

        return updatedEvent

    async def search(self, userId: int, searchQuery: str, limit: int = 250) -> List[Event]:
        """TODO: Handle searches for instances of recurring events."""
        rows = await self.session.execute(
            text(EVENT_SEARCH_QUERY), {'userId': userId, 'query': searchQuery, 'limit': limit}
        )
        rowIds = [r[0] for r in rows]

        # TODO: GET the calendar ID
        stmt = getBaseEventsStmt().filter(Event.id.in_(rowIds)).order_by(desc(Event.end))
        result = await self.session.execute(stmt)

        return result.scalars().all()

    async def updateEventParticipants(
        self, user: User, event: Event, newParticipants: List[EventParticipantVM]
    ):
        """Create and update event participants.
        # TODO: Check the errors first.
        # TODO: Option to send invites to participants.
        """
        # Remove previous participants.
        event.participants = []

        # Add participants, matched with contacts.
        contactRepo = ContactRepository(self.session)
        existingContactIds = set()  # Make sure we don't add duplicate contacts

        for participantVM in newParticipants:
            existingContact = await contactRepo.findContact(user, participantVM)
            if existingContact and existingContact.id in existingContactIds:
                raise EventRepoError('Duplicate contact found.')

            if existingContact:
                existingContactIds.add(existingContact.id)

            participant = EventParticipant(
                participantVM.email, participantVM.contact_id, participantVM.response_status
            )
            participant.contact = existingContact

            event.participants.append(participant)


async def getCombinedLabels(
    user: User, labelVMs: List[LabelInDbVM], session: AsyncSession
) -> List[Label]:
    """"List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []
    for labelVM in labelVMs:
        # TODO: Bulk Query
        stmt = select(Label).where(and_(User.id == user.id, Label.id == labelVM.id))
        label = (await session.execute(stmt)).scalar()

        if label:
            labels.append(label)

    return combineLabels(labels)


async def createOverrideDeletedEvent(
    calendar: UserCalendar, eventId: str, session: AsyncSession
) -> Event:
    # Override as a deleted event.
    eventVM, parentEvent = await getRecurringEventWithParent(calendar, eventId, session)

    googleId = None
    if parentEvent.recurring_event_gId:
        googleId = getRecurringEventId(
            parentEvent.recurring_event_gId, eventVM.original_start, parentEvent.all_day
        )

    event = Event(
        googleId,
        None,
        None,
        None,
        None,
        None,
        None,
        calendar.id,
        None,
        None,
        eventVM.original_start,
        eventVM.original_start.strftime('%Y-%m-%d') if parentEvent.all_day else None,
        parentEvent.time_zone,
        overrideId=eventId,
        recurringEventId=parentEvent.id,
        status='deleted',
    )

    return event


async def getRecurringEventWithParent(
    calendar: Calendar, eventId: str, session: AsyncSession
) -> Tuple[EventInDBVM, Event]:
    """Returns the parent from the virtual eventId.
    Returns tuple of (parent event, datetime).

    A recurring event will always have an ID of {event-id}_{datetime}.
    For example, M8QdZr4AxuZ5snRJ932prW_20220124T150000Z.

    Throws InputError if it's not a valid event ID.
    """
    parts = eventId.split('_')
    if not len(parts) >= 2:
        raise InputError(f'Invalid Event ID: {eventId}')

    parentId = ''.join(parts[:-1])

    stmt = select(Event).where(Calendar.id == calendar.id, Event.id == parentId)
    parentEvent = (await session.execute(stmt)).scalar()

    if not parentEvent:
        raise InputError(f'Invalid Event ID: {eventId}')

    eventInDbVM = getRecurringEvent(calendar, eventId, parentEvent)

    return eventInDbVM, parentEvent


def getRecurringEvent(calendar: UserCalendar, eventId: str, parentEvent: Event) -> EventInDBVM:
    """Makes sure the eventId is part of the parent Event ID.

    Returns tuple of (Event, datetime)
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

        for e in getExpandedRecurringEvents(calendar.user, calendar, parentEvent, {}, dt, dt):
            if e.id == eventId:
                return e

        raise InputError('Invalid Event ID.')

    except ValueError:
        raise InputError('Invalid Event ID.')


async def getAllExpandedRecurringEventsList(
    user: User, calendar: UserCalendar, startDate: datetime, endDate: datetime, session
) -> List[EventInDBVM]:
    expandedEvents = [
        i async for i in getAllExpandedRecurringEvents(user, calendar, startDate, endDate, session)
    ]

    return sorted(
        expandedEvents,
        key=lambda event: event.start,
    )


async def getAllExpandedRecurringEvents(
    user: User, calendar: UserCalendar, startDate: datetime, endDate: datetime, session
) -> AsyncGenerator[EventInDBVM, None]:
    """Expands the rule in the event to get all events between the start and end.
    TODO: This expansion is a huge perf bottleneck..
    - Date expansions are CPU bound so we could rewrite the date rrules expansion in a rust binding.
    - Don't need to expand ALL baseRecurringEvents, just ones in between the range.
    - => cache the end dates properties to recurring events on insert / update.

    TODO: Update EXDATE on write so we don't have to manually override events.
    """

    # Events that override the base events in the recurrence.
    overridesStmt = getBaseEventsStmt().where(
        User.id == user.id,
        Event.recurrences == None,
        Event.recurring_event_id != None,
        Calendar.id == calendar.id,
    )

    # Moved from outside of this time range to within.
    movedFromOutsideOverridesStmt = overridesStmt.where(
        Event.end >= startDate,
        Event.start <= endDate,
        Event.status != 'deleted',
        # Original is outside the current range.
        or_(
            Event.original_start == None,  # TODO: remove None
            or_(
                Event.original_start < startDate,
                Event.original_start > endDate,
            ),
        ),
    )
    result = await session.execute(movedFromOutsideOverridesStmt)

    for eventOverride in result.scalars():
        yield EventInDBVM.from_orm(eventOverride)

    # Overrides from within this time range.
    movedFromInsideOverrides = overridesStmt.where(
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

    baseRecurringEventsStmt = getBaseEventsStmt().where(
        User.id == user.id,
        Calendar.id == calendar.id,
        Event.recurrences != None,
        Event.recurring_event_id == None,
        Event.status != 'deleted',
        Event.start <= endDate,
    )

    result = await session.execute(baseRecurringEventsStmt)
    for baseRecurringEvent in result.scalars():
        for e in getExpandedRecurringEvents(
            user, calendar, baseRecurringEvent, eventOverridesMap, startDate, endDate
        ):
            yield e


def getExpandedRecurringEvents(
    user: User,
    userCalendar: UserCalendar,
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
    timezone = baseRecurringEvent.time_zone or userCalendar.timezone or user.timezone

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
            zone = baseRecurringEvent.time_zone or userCalendar.timezone or user.timezone
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

                        eventVM = EventInDBVM.from_orm(eventOverride)
                        eventVM.calendar_id = userCalendar.id  # TODO: Remove this

                        yield eventVM
                else:
                    eventVM = baseEventVM.copy(
                        update={
                            'id': eventId,
                            'calendar_id': userCalendar.id,
                            'start': start,
                            'end': end,
                            'start_day': start.strftime('%Y-%m-%d') if isAllDay else None,
                            'end_day': end.strftime('%Y-%m-%d') if isAllDay else None,
                            'recurring_event_id': baseRecurringEvent.id,
                            'recurrences': baseRecurringEvent.recurrences,
                            'original_start': start,
                            'original_start_day': start.strftime('%Y-%m-%d') if isAllDay else None,
                        }
                    )

                    yield eventVM
