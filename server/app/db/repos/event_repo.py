import heapq
from typing import List, Optional, Iterable, Tuple, Generator, AsyncGenerator, Dict, cast
from datetime import datetime
from zoneinfo import ZoneInfo
from itertools import islice
from datetime import timedelta
import logging

from sqlalchemy import asc, and_, select, delete, or_, update
from sqlalchemy.orm import selectinload, Session
from sqlalchemy import text, asc
from sqlalchemy.sql.selectable import Select

from app.core.logger import logger
from app.db.sql.event_search import EVENT_SEARCH_QUERY
from app.db.sql.event_search_recurring import RECURRING_EVENT_SEARCH_QUERY
from app.db.models import Event, User, UserCalendar, Calendar, EventAttendee

from app.db.repos.contact_repo import ContactRepository
from app.db.repos.calendar_repo import CalendarRepo
from app.db.repos.event_utils import (
    EventBaseVM,
    EventInDBVM,
    GoogleEventInDBVM,
    EventParticipantVM,
    createOrUpdateEvent,
    getRecurringEventId,
    recurrenceToRuleSet,
)

from app.api.endpoints.labels import LabelInDbVM, Label, combineLabels
from app.db.repos.exceptions import (
    EventRepoError,
    InputError,
    EventNotFoundError,
    RepoError,
    EventRepoPermissionError,
)


MAX_RECURRING_EVENT_COUNT = 1000


BASE_EVENT_STATEMENT = (
    select(Event)
    .options(selectinload(Event.participants))
    .options(selectinload(Event.creator))
    .options(selectinload(Event.organizer))
    .options(selectinload(Event.labels))
)


def getCalendarEventsStmt():
    """Statement to fetch events for a user calendar."""
    return BASE_EVENT_STATEMENT.join(Event.calendar).join(Calendar.user_calendars).join(User)


class EventRepository:
    """
    Combination of a Service / Repository over events.
    Provides an abstraction over SQLAlchemy.

    Should be self-contained, without dependencies to google or other services.
    """

    def __init__(self, session: Session):
        self.session = session

    def getRecurringEvents(self, user: User, calendarId: str, endDate: datetime) -> list[Event]:
        stmt = (
            getCalendarEventsStmt()
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

        result = self.session.execute(stmt)

        return list(result.scalars().all())

    def getSingleEvents(
        self, user: User, calendarId: str, showRecurring: bool = True
    ) -> list[Event]:
        """Gets all events for the calendar."""
        stmt = getCalendarEventsStmt().where(and_(User.id == user.id, Calendar.id == calendarId))

        if not showRecurring:
            stmt = stmt.filter(Event.recurring_event_id == None)

        result = self.session.execute(stmt)
        singleEvents = result.scalars().all()

        return list(singleEvents)

    def getEventsInRange(
        self, user: User, calendarId: str, startDate: datetime, endDate: datetime, limit: int
    ) -> Iterable[EventInDBVM]:
        calendarRepo = CalendarRepo(self.session)
        calendar = calendarRepo.getCalendar(user, calendarId)

        singleEventsStmt = (
            getCalendarEventsStmt()
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
        result = self.session.execute(singleEventsStmt)
        singleEvents = result.scalars().all()

        expandedRecurringEvents = getAllExpandedRecurringEventsList(
            user, calendar, startDate, endDate, self.session
        )

        allEvents = heapq.merge(
            expandedRecurringEvents, singleEvents, key=lambda event: event.start
        )

        return allEvents

    def getGoogleEvent(self, calendar: UserCalendar, googleEventId: str) -> Optional[Event]:
        stmt = getCalendarEventsStmt().where(
            Calendar.id == calendar.id, Event.g_id == googleEventId
        )
        googleEvent = (self.session.execute(stmt)).scalar()

        return googleEvent

    def getEvent(self, user: User, calendar: UserCalendar, eventId: str) -> Optional[Event]:
        """Gets an event that exists in the DB only.
        Does not include overriden instances of recurring events.
        """
        curEvent: Optional[Event] = (
            self.session.execute(
                getCalendarEventsStmt().where(
                    User.id == user.id, Calendar.id == calendar.id, Event.id == eventId
                )
            )
        ).scalar()

        return curEvent

    def getEventVM(
        self, user: User, calendar: UserCalendar, eventId: str
    ) -> Optional[GoogleEventInDBVM]:
        """Gets the event view model, which includes instances of recurring events."""
        eventInDB = self.getEvent(user, calendar, eventId)

        if eventInDB:
            return GoogleEventInDBVM.from_orm(eventInDB)
        else:
            # Check if it's a virtual event within a recurrence.
            event, _ = self.getRecurringEventWithParent(calendar, eventId, self.session)

            return event

    def createEvent(self, user: User, userCalendar: UserCalendar, event: EventBaseVM) -> Event:
        self.verifyPermissions(userCalendar, None, event)

        # Keeps track of the "Original" time this recurrence should have started.
        if event.recurrences or event.recurring_event_id:
            event.original_start = event.start
            event.original_start_day = event.start_day
            event.original_timezone = event.timezone

        eventDb = createOrUpdateEvent(userCalendar, None, event)
        eventDb.labels = getCombinedLabels(user, event.labels, self.session)
        self.session.commit()

        newEvent = self.getEvent(user, userCalendar, eventDb.id)
        if not newEvent:
            raise EventNotFoundError

        self.updateEventParticipants(userCalendar, newEvent, event.participants)
        self.session.commit()

        return newEvent

    def deleteEvent(self, user: User, userCalendar: UserCalendar, eventId: str) -> Event:
        """
        TODO: Propagate changes to all copies of the event.
        """
        if not userCalendar.hasWriteAccess():
            raise RepoError('User cannot write event.')

        event = self.getEvent(user, userCalendar, eventId)

        if event:
            event.status = 'deleted'

            # Delete the parent of a recurring event => also delete all child events.
            stmt = delete(Event).where(Event.recurring_event_id == event.id)
            self.session.execute(stmt)
            self.session.commit()

            return event

        else:
            # Virtual recurring event instance.
            try:
                eventVM, parentEvent = self.getRecurringEventWithParent(
                    userCalendar, eventId, self.session
                )

                eventOverride = (
                    self.session.execute(
                        select(Event).where(
                            Event.recurring_event_id == parentEvent.id,
                            Event.recurring_event_calendar_id == userCalendar.id,
                            Event.id == eventId,
                        )
                    )
                ).scalar()

                if eventOverride:
                    eventOverride.status = 'deleted'
                else:
                    if not eventVM.original_start:
                        raise EventRepoError('No original start for recurring event.')

                    eventOverride = createOverrideDeletedEvent(
                        parentEvent, eventVM.original_start, eventVM.id
                    )
                    self.session.add(eventOverride)

                self.session.commit()

                return eventOverride

            except InputError as e:
                raise EventNotFoundError('Event not found.')

    def verifyPermissions(
        self, userCalendar: UserCalendar, event: Optional[Event], newEvent: EventBaseVM
    ) -> None:
        """Makes sure the user has the correct permissions to modify the event.
        If the event's organizer matches this user, then I own the event.

        The organizer of the event owns the main event properties.
        (title, description, location, start, end, recurrence).

        Raises an EventRepoPermissionError if the user does not have the correct permissions.
        """

        if not userCalendar.hasWriteAccess():
            # Access role is read only.
            raise EventRepoPermissionError("Can not update event with this calendar.")

        # User is modifying an existing event.
        if event:
            isOrganizer = event.isOrganizer(userCalendar)
            canModifyEvent = isOrganizer or event.guests_can_modify

            hasModifiedMainEventFields = (
                event.title != newEvent.title
                or event.description != newEvent.description
                or event.start != newEvent.start
                or event.end != newEvent.end
                or event.recurrences != newEvent.recurrences
                or event.guests_can_invite_others != newEvent.guests_can_invite_others
                or event.guests_can_modify != newEvent.guests_can_modify
                or event.guests_can_see_other_guests != newEvent.guests_can_see_other_guests
            )

            if not canModifyEvent and hasModifiedMainEventFields:
                raise EventRepoPermissionError(
                    "Can not modify event. Only the organizer can modify these fields."
                )

    def updateEvent(
        self,
        user: User,
        userCalendar: UserCalendar,
        eventId: str,
        event: EventBaseVM,
    ) -> Event:
        curEvent = self.getEvent(user, userCalendar, eventId)
        self.verifyPermissions(userCalendar, curEvent, event)

        # Not found in DB.
        if not curEvent and not event.recurring_event_id:
            raise EventNotFoundError(f'Event not found.')

        # This is an instance of a recurring event. Replace the recurring event instance with and override.
        elif not curEvent and event.recurring_event_id:
            parentEvent = self.getEvent(user, userCalendar, event.recurring_event_id)

            if not parentEvent:
                raise EventNotFoundError(f'Invalid parent event {event.recurring_event_id}.')

            try:
                eventVM = getRecurringEvent(userCalendar, eventId, parentEvent)
            except InputError as err:
                raise EventNotFoundError(str(err))

            if not eventVM.original_start:
                raise EventRepoError('No original start for recurring event.')

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

            existingOverrideInstance = (
                self.session.execute(
                    select(Event).where(
                        Event.recurring_event_id == parentEvent.id,
                        Event.recurring_event_calendar_id == parentEvent.calendar_id,
                        Event.id == eventId,
                    )
                )
            ).scalar()

            updatedEvent = createOrUpdateEvent(
                userCalendar, existingOverrideInstance, event, overrideId=eventId, googleId=googleId
            )
            self.session.add(updatedEvent)
            self.session.commit()

            # Re-fetch the event to get the updated participants.
            if refreshedEvent := self.getEvent(user, userCalendar, updatedEvent.id):
                updatedEvent = refreshedEvent

        # We are overriding a parent recurring event.
        elif curEvent and curEvent.is_parent_recurring_event:
            # Since we're modifying the recurrence, we need to remove all previous overrides.
            # TODO: Only delete the overrides that no longer exist.
            if curEvent.recurrences != event.recurrences:
                stmt = delete(Event).where(
                    and_(
                        Event.recurring_event_id == curEvent.id,
                        Event.recurring_event_calendar_id == curEvent.calendar_id,
                    )
                )
                self.session.execute(stmt)

            updatedEvent = createOrUpdateEvent(userCalendar, curEvent, event)

        # Update normal event.
        else:
            updatedEvent = createOrUpdateEvent(userCalendar, curEvent, event)

        updatedEvent.labels.clear()
        updatedEvent.labels = getCombinedLabels(user, event.labels, self.session)

        self.updateEventParticipants(userCalendar, updatedEvent, event.participants)
        self.session.commit()

        return updatedEvent

    def moveEvent(self, user: User, eventId: str, fromCalendarId: str, toCalendarId: str) -> Event:
        calendarRepo = CalendarRepo(self.session)

        fromCalendar = calendarRepo.getCalendar(user, fromCalendarId)
        toCalendar = calendarRepo.getCalendar(user, toCalendarId)
        if fromCalendar.id == toCalendar.id:
            raise EventRepoError('Cannot move between same calendars')

        event = self.getEvent(user, fromCalendar, eventId)
        if not event:
            raise EventRepoError(f'Cannot move the event.')

        if event.recurring_event_id is not None:
            raise EventRepoError('Cannot move instance of recurring event.')

        stmt = (
            update(Event)
            .where(Event.id == eventId, Event.calendar_id == fromCalendar.id)
            .values(calendar_id=toCalendar.id)
        )
        self.session.execute(stmt)
        self.session.commit()

        return event

    def search(
        self, user: User, searchQuery: str, start: datetime, end: datetime, limit: int = 250
    ) -> Iterable[EventInDBVM]:
        """TODO: Limit number of events. Pagination?"""
        # 1) Single Events
        rows = self.session.execute(
            text(EVENT_SEARCH_QUERY),
            {'userId': user.id, 'query': searchQuery, 'start': start, 'end': end},
        )
        rowIds = [r[0] for r in rows]
        stmt = getCalendarEventsStmt().filter(Event.id.in_(rowIds)).order_by(asc(Event.end))
        singleEvents = (self.session.execute(stmt)).scalars().all()
        recurringEventInstanceIds = set([e.id for e in singleEvents if e.recurring_event_id])

        # 2) Recurring events + deduplicate from (1)
        rows = self.session.execute(
            text(RECURRING_EVENT_SEARCH_QUERY),
            {'userId': user.id, 'query': searchQuery},
        )
        rowIds = [r[0] for r in rows]
        stmt = getCalendarEventsStmt().where(Event.id.in_(rowIds))
        recurringEvents = [
            i
            for i in getAllExpandedRecurringEvents(
                user, stmt, start, end, searchQuery, self.session
            )
            if i.id not in recurringEventInstanceIds
        ]

        # 3) Merge the two
        allEvents = heapq.merge(recurringEvents, singleEvents, key=lambda event: event.start)

        return allEvents

    def updateEventParticipants(
        self,
        userCalendar: UserCalendar,
        event: Event,
        newParticipants: List[EventParticipantVM],
    ) -> None:
        """Create and update event participants.
        I can only modify the attendee that corresponds to this user, or if I'm the organizer.

        TODO: Have option to send invites with Chrono. Currently defers to google to send invites
        to new participants.
        """
        # Permissions check.
        user = userCalendar.user
        isOrganizer = event.isOrganizer(userCalendar)
        canModifyEvent = isOrganizer or event.guests_can_modify
        canInviteAttendees = canModifyEvent or event.guests_can_invite_others

        # Add participants, matched with contacts.
        currentAttendeesMap = {p.email: p for p in event.participants}
        newAttendeesMap = set(p.email for p in newParticipants)

        contactRepo = ContactRepository(self.session)
        existingContactIds = set()  # Make sure we don't add duplicate contacts

        for participantVM in newParticipants:
            existingContact = contactRepo.findContact(user, participantVM)
            if existingContact and existingContact.id in existingContactIds:
                raise EventRepoError('Duplicate contact found.')

            if existingContact:
                existingContactIds.add(existingContact.id)

            if participantVM.email in currentAttendeesMap:
                # Existing Attendee
                participant = currentAttendeesMap[participantVM.email]
                ownsAttendee = isOrganizer or participant.email == user.email

                if ownsAttendee:
                    participant.response_status = participantVM.response_status
            else:
                # New Attendee
                if not canInviteAttendees:
                    raise EventRepoPermissionError(
                        'You do not have permission to invite attendees.'
                    )

                ownsAttendee = isOrganizer or participantVM.email == user.email
                participant = EventAttendee(
                    participantVM.email,
                    participantVM.display_name if ownsAttendee else None,
                    existingContact.id if existingContact else None,
                    participantVM.response_status if ownsAttendee else 'needsAction',
                )
                event.participants.append(participant)
                participant.contact = existingContact

        # Can remove events if the user is the organizer.
        if isOrganizer:
            for email, attendee in currentAttendeesMap.items():
                if email not in newAttendeesMap:
                    event.participants.remove(attendee)

    def getRecurringEventWithParent(
        self, calendar: UserCalendar, eventId: str, session: Session
    ) -> Tuple[GoogleEventInDBVM, Event]:
        """Returns the parent from the virtual eventId.
        Returns tuple of (parent event, datetime).

        A recurring event will always have an ID of {event-id}_{datetime}.
        For example, M8QdZr4AxuZ5snRJ932prW_20220124T150000Z.

        Throws InputError if it's not a valid event ID.
        """
        parts = eventId.split('_')
        if not len(parts) >= 2:
            raise EventNotFoundError(f'Event ID {eventId} not found.')

        parentId = ''.join(parts[:-1])
        parentEvent = self.getEvent(calendar.user, calendar, parentId)

        if not parentEvent:
            raise EventNotFoundError(f'Event ID {eventId} not found.')

        eventInDbVM = getRecurringEvent(calendar, eventId, parentEvent)

        return eventInDbVM, parentEvent


def getCombinedLabels(user: User, labelVMs: List[LabelInDbVM], session: Session) -> List[Label]:
    """List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []

    userLabels = {l.id: l for l in user.labels}
    for labelVM in labelVMs:
        label = userLabels.get(labelVM.id)

        if label:
            labels.append(label)
        else:
            raise EventRepoError(f'Label "{labelVM.title}" not found.')

    return combineLabels(labels)


def createOverrideDeletedEvent(
    parentEvent: Event,
    originalStart: datetime,
    eventId: str,
) -> Event:
    """Overrides a recurring event as a deleted event."""
    googleId = None
    if parentEvent.recurring_event_gId:
        googleId = getRecurringEventId(
            parentEvent.recurring_event_gId, originalStart, parentEvent.all_day
        )

    event = Event(
        googleId,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        originalStart,
        originalStart.strftime('%Y-%m-%d') if parentEvent.all_day else None,
        parentEvent.time_zone,
        None,
        None,
        None,
        None,
        None,
        overrideId=eventId,
        recurringEventId=parentEvent.id,
        recurringEventCalendarId=parentEvent.calendar_id,
        status='deleted',
    )

    return event


def getRecurringEvent(
    calendar: UserCalendar, eventId: str, parentEvent: Event
) -> GoogleEventInDBVM:
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

        for e in getExpandedRecurringEvents(calendar.user, parentEvent, {}, dt, dt):
            if e.id == eventId:
                return e

        raise InputError(f'Invalid Event ID: {eventId}')

    except ValueError:
        raise InputError(f'Invalid Event ID: {eventId}')


def getAllExpandedRecurringEventsList(
    user: User,
    calendar: UserCalendar,
    startDate: datetime,
    endDate: datetime,
    session: Session,
) -> List[EventInDBVM]:
    """Expands all recurring events for the calendar."""

    baseRecurringEventsStmt = getCalendarEventsStmt().where(
        User.id == user.id,
        Calendar.id == calendar.id,
        Event.recurrences != None,
        Event.recurring_event_id == None,
        Event.status != 'deleted',
        Event.start <= endDate,
    )

    expandedEvents = [
        i
        for i in getAllExpandedRecurringEvents(
            user, baseRecurringEventsStmt, startDate, endDate, None, session
        )
    ]

    return sorted(
        expandedEvents,
        key=lambda event: event.start,
    )


def getAllExpandedRecurringEvents(
    user: User,
    baseRecurringEventsStmt: Select,
    startDate: datetime,
    endDate: datetime,
    query: Optional[str],
    session: Session,
) -> Generator[EventInDBVM, None, None]:
    """Expands the rule in the event to get all events between the start and end.

    Since we don't do this direct from SQL, we take in a query to filter out instances of
    recurring events which a modified title.

    TODO: This expansion is a huge perf bottleneck..
    - Date expansions are CPU bound so we could rewrite the date rrules expansion in a rust binding.
    - Don't need to expand ALL baseRecurringEvents, just ones in between the range.
    - => cache the end dates properties to recurring events on insert / update.

    TODO: Update EXDATE on write so we don't have to manually override events.
    """
    baseRecurringEvents = session.execute(baseRecurringEventsStmt)

    baseEventsSubQ = baseRecurringEventsStmt.subquery()
    overridesStmt = BASE_EVENT_STATEMENT.join(
        baseEventsSubQ, Event.recurring_event_id == baseEventsSubQ.c.id
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
    result = session.execute(movedFromOutsideOverridesStmt)

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

    result = session.execute(movedFromInsideOverrides)
    eventOverridesMap: Dict[str, Event] = {e.id: e for e in result.scalars()}

    for baseRecurringEvent in baseRecurringEvents.scalars():
        for e in getExpandedRecurringEvents(
            user, baseRecurringEvent, eventOverridesMap, startDate, endDate, query
        ):
            yield e


def getExpandedRecurringEvents(
    user: User,
    baseRecurringEvent: Event,
    eventOverridesMap: Dict[str, Event],
    startDate: datetime,
    endDate: datetime,
    query: Optional[str] = None,
) -> Generator[GoogleEventInDBVM, None, None]:
    """Precondition: Make sure calendar is joined with the baseRecurringEvent

    For now, assumes that the ruleset composes only of one rrule, and exdates so that
    we can do optimizations like checking for _dtstart and _until.
    """
    duration = baseRecurringEvent.end - baseRecurringEvent.start
    isAllDay = baseRecurringEvent.all_day
    baseEventVM = GoogleEventInDBVM.from_orm(baseRecurringEvent)
    userCalendar = baseRecurringEvent.calendar
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
                    if eventOverride.status != 'deleted' and eventMatchesQuery(
                        eventOverride, query
                    ):
                        eventOverride.recurrences = baseRecurringEvent.recurrences

                        eventVM = GoogleEventInDBVM.from_orm(eventOverride)
                        eventVM.calendar_id = userCalendar.id  # TODO: Remove this

                        yield eventVM
                else:
                    eventVM = baseEventVM.copy(
                        update={
                            'id': eventId,
                            'g_id': getRecurringEventId(baseEventVM.g_id, start, isAllDay),
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


def eventMatchesQuery(event: Event, query: Optional[str]) -> bool:
    """Python version of full text search for expanded recurring events.
    This needs to match the full text query in event_search.py.
    """
    if not query:
        return True

    needles = [token.strip().lower() for token in query.split('|')]
    haystack = event.title.lower()

    return any(needle in haystack for needle in needles)