import uuid
import json
import heapq

from typing import List, Optional, Iterable, Tuple, Generator, Dict
from datetime import datetime
from zoneinfo import ZoneInfo
from itertools import islice
from datetime import timedelta
import logging
from dateutil.rrule import rrule

from sqlalchemy import asc, and_, select, or_, update, text
from sqlalchemy.orm import selectinload, Session
from sqlalchemy.sql.selectable import Select

from app.db.models.conference_data import (
    ConferenceCreateRequest,
    ConferenceData,
    ConferenceEntryPoint,
    ConferenceSolution,
    ChronoConferenceType,
)
from app.db.repos.event_repo.view_models import (
    EventBaseVM,
    EventInDBVM,
    EventParticipantVM,
    ConferenceDataBaseVM,
    ConferenceSolutionVM,
    EntryPointBaseVM,
    GoogleEventInDBVM,
    recurrenceToRuleSet,
)

from app.db.sql.event_search import EVENT_SEARCH_QUERY
from app.db.sql.event_search_recurring import RECURRING_EVENT_SEARCH_QUERY
from app.db.models import (
    Event,
    EventCreator,
    EventOrganizer,
    User,
    UserCalendar,
    Calendar,
    EventAttendee,
    ReminderOverride,
)
from app.db.models.conference_data import ConferenceKeyType, CommunicationMethod

from app.db.repos.contact_repo import ContactRepository
from app.db.repos.calendar_repo import CalendarRepository
from app.db.repos.exceptions import (
    EventRepoError,
    InputError,
    EventNotFoundError,
    RepoError,
    EventRepoPermissionError,
)

from app.api.endpoints.labels import LabelInDbVM, Label, combineLabels
from app.utils.zoom import ZoomAPI, ZoomMeetingInput

ZOOM_IMAGE = 'https://lh3.googleusercontent.com/d/1HWZ0YS-xLVSAoQ2SUDuC3iFRtdm8a-FR'

MAX_RECURRING_EVENT_COUNT = 1000

BASE_EVENT_STATEMENT = (
    select(Event)
    .options(selectinload(Event.participants))
    .options(selectinload(Event.creator))
    .options(selectinload(Event.organizer))
    .options(selectinload(Event.labels))
    .options(selectinload(Event.conference_data))
    .options(selectinload(Event.reminders))
)


def getCalendarEventsStmt():
    """Statement to fetch events for a user calendar."""
    return (
        BASE_EVENT_STATEMENT.join(Event.calendar)
        .join(Calendar.user_calendars)
        .join(UserCalendar.account)
        .join(User)
    )


class EventRepository:
    """
    Combination of a Service / Repository over events.
    Provides an abstraction over SQLAlchemy.

    Should be self-contained, without dependencies to google or other services.
    """

    def __init__(self, user: User, session: Session):
        self.session = session
        self.user = user
        self.zoomAPI: ZoomAPI | None = None

        if self.user.zoom_connection:
            self.zoomAPI = ZoomAPI(self.session, self.user.zoom_connection)

    def getRecurringEvents(self, calendarId: uuid.UUID, endDate: datetime) -> list[Event]:
        stmt = (
            getCalendarEventsStmt()
            .where(User.id == self.user.id)
            .filter(
                and_(
                    and_(Event.recurrences != None, Event.recurrences != []),
                    Event.recurring_event_id == None,
                    Event.status != 'deleted',
                )
            )
            .where(Event.start <= endDate, UserCalendar.id == calendarId)
        )

        result = self.session.execute(stmt)

        return list(result.scalars().all())

    def getSingleEvents(
        self, calendarId: uuid.UUID, showRecurring: bool = True, showDeleted=False
    ) -> list[Event]:
        """Gets all events for the calendar."""
        stmt = getCalendarEventsStmt().where(
            and_(User.id == self.user.id, Calendar.id == calendarId)
        )

        if not showDeleted:
            stmt = stmt.filter(Event.status != 'deleted')

        if not showRecurring:
            stmt = stmt.filter(Event.recurring_event_id == None)

        result = self.session.execute(stmt)
        singleEvents = result.scalars().all()

        return list(singleEvents)

    def getEventsInRange(
        self, calendarId: uuid.UUID, startDate: datetime, endDate: datetime, limit: int
    ) -> Iterable[EventInDBVM]:
        calendarRepo = CalendarRepository(self.session)
        calendar = calendarRepo.getCalendar(self.user, calendarId)

        singleEventsStmt = (
            getCalendarEventsStmt()
            .where(
                User.id == self.user.id,
                UserCalendar.id == calendarId,
                or_(Event.recurrences == None, Event.recurrences == []),
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
            self.user, calendar, startDate, endDate, self.session
        )

        allEvents = heapq.merge(
            expandedRecurringEvents, singleEvents, key=lambda event: event.start
        )

        return allEvents

    def getGoogleEvent(self, calendar: UserCalendar, googleEventId: str) -> Optional[Event]:
        stmt = getCalendarEventsStmt().where(
            Calendar.id == calendar.id, Event.google_id == googleEventId
        )
        googleEvent = (self.session.execute(stmt)).scalar()

        return googleEvent

    def getEvent(self, calendar: UserCalendar, eventId: str) -> Optional[Event]:
        """Gets an event that exists in the DB only.
        Does not include overriden instances of recurring events.
        """
        curEvent: Optional[Event] = (
            self.session.execute(
                getCalendarEventsStmt().where(
                    User.id == self.user.id, Calendar.id == calendar.id, Event.id == eventId
                )
            )
        ).scalar()

        return curEvent

    def getEventVM(self, calendar: UserCalendar, eventId: str) -> Optional[GoogleEventInDBVM]:
        """Gets the event view model, which includes instances of recurring events."""
        eventInDB = self.getEvent(calendar, eventId)

        if eventInDB:
            return GoogleEventInDBVM.model_validate(eventInDB)
        else:
            # Check if it's a virtual event within a recurrence.
            event, _ = self.getRecurringEventWithParent(calendar, eventId)

            return event

    def createEvent(self, userCalendar: UserCalendar, event: EventBaseVM) -> Event:
        self.verifyPermissions(userCalendar, None, event)

        if event.id and self.getEvent(userCalendar, event.id):
            raise EventRepoError('Could not create event with existing id.')

        # Keeps track of the "Original" time this recurrence should have started.
        if event.recurrences or event.recurring_event_id:
            event.original_start = event.start
            event.original_start_day = event.start_day
            event.original_timezone = event.timezone

        # If conferencing is Chrono's type, we need to create a conference data object manually.
        event = self._populateEventConferenceData(None, event)
        eventDb = createOrUpdateEvent(userCalendar, None, event, overrideId=event.id)
        eventDb.labels = getCombinedLabels(self.user, event.labels, self.session)

        self.session.commit()

        newEvent = self.getEvent(userCalendar, eventDb.id)
        if not newEvent:
            raise EventNotFoundError

        self._updateEventParticipants(userCalendar, newEvent, event.participants)

        self.session.commit()

        return newEvent

    def deleteEvent(self, userCalendar: UserCalendar, eventId: str) -> Event:
        """
        TODO: Propagate changes to all copies of the event.
        """
        if not userCalendar.hasWriteAccess():
            raise RepoError('User cannot write event.')

        event = self.getEvent(userCalendar, eventId)

        if event:
            event.status = 'deleted'

            # Delete the parent of a recurring event => also delete all child events.
            # TODO: Delete all with cascade / why not working now?
            for e in self.session.query(Event).filter(
                Event.recurring_event_id == event.id,
            ):
                self.session.delete(e)

            self._deleteConferenceData(event)
            self.session.commit()

            return event

        else:
            # Virtual recurring event instance.
            try:
                eventVM, parentEvent = self.getRecurringEventWithParent(userCalendar, eventId)

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

                    eventOverride = createOverrideDeletedEvent(parentEvent, eventVM)
                    userCalendar.calendar.events.append(eventOverride)
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
                (event.title or '') != (newEvent.title or '')
                or (event.description or '') != (newEvent.description or '')
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
        userCalendar: UserCalendar,
        eventId: str,
        event: EventBaseVM,
    ) -> Event:
        curEvent = self.getEvent(userCalendar, eventId)
        self.verifyPermissions(userCalendar, curEvent, event)

        # Not found in DB.
        if not curEvent and not event.recurring_event_id:
            raise EventNotFoundError('Event not found.')

        # This is an instance of a recurring event. Replace the recurring event instance with and override.
        elif not curEvent and event.recurring_event_id:
            parentEvent = self.getEvent(userCalendar, event.recurring_event_id)

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

            event = self._populateEventConferenceData(curEvent, EventBaseVM.model_validate(event))
            updatedEvent = createOrUpdateEvent(
                userCalendar, existingOverrideInstance, event, overrideId=eventId, googleId=googleId
            )
            self.session.add(updatedEvent)
            self.session.commit()

            # Re-fetch the event to get the updated participants.
            if refreshedEvent := self.getEvent(userCalendar, updatedEvent.id):
                updatedEvent = refreshedEvent

        # We are overriding a parent recurring event.
        elif curEvent and curEvent.is_parent_recurring_event:
            event = self._populateEventConferenceData(curEvent, EventBaseVM.model_validate(event))
            updatedEvent = createOrUpdateEvent(userCalendar, curEvent, event)

            self._updateRecurringEventOverrides(userCalendar, updatedEvent)

        # Update normal event.
        else:
            event = self._populateEventConferenceData(curEvent, EventBaseVM.model_validate(event))
            updatedEvent = createOrUpdateEvent(userCalendar, curEvent, event)

        updatedEvent.labels.clear()
        updatedEvent.labels = getCombinedLabels(self.user, event.labels, self.session)

        self._updateEventParticipants(userCalendar, updatedEvent, event.participants)
        self.session.commit()

        return updatedEvent

    def moveEvent(self, eventId: str, fromCalendarId: uuid.UUID, toCalendarId: uuid.UUID) -> Event:
        calendarRepo = CalendarRepository(self.session)

        fromCalendar = calendarRepo.getCalendar(self.user, fromCalendarId)
        toCalendar = calendarRepo.getCalendar(self.user, toCalendarId)

        if fromCalendar.id == toCalendar.id:
            raise EventRepoError('Cannot move between same calendars')

        if fromCalendar.account_id != toCalendar.account_id:
            raise EventRepoError('Cannot move event between different accounts')

        event = self.getEvent(fromCalendar, eventId)
        if not event:
            raise EventNotFoundError(f'Event {eventId} not found.')

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
        self, searchQuery: str, start: datetime, end: datetime, limit: int = 250
    ) -> Iterable[EventInDBVM]:
        """TODO: Limit number of events. Pagination?"""
        # 1) Single Events
        rows = self.session.execute(
            text(EVENT_SEARCH_QUERY),
            {'userId': self.user.id, 'query': searchQuery, 'start': start, 'end': end},
        )
        rowIds = [r[0] for r in rows]
        stmt = getCalendarEventsStmt().filter(Event.id.in_(rowIds)).order_by(asc(Event.end))
        singleEvents = (self.session.execute(stmt)).scalars().all()
        recurringEventInstanceIds = set([e.id for e in singleEvents if e.recurring_event_id])

        # 2) Recurring events + deduplicate from (1)
        rows = self.session.execute(
            text(RECURRING_EVENT_SEARCH_QUERY),
            {'userId': self.user.id, 'query': searchQuery},
        )
        rowIds = [r[0] for r in rows]
        stmt = getCalendarEventsStmt().where(Event.id.in_(rowIds))
        recurringEvents = [
            i
            for i in getAllExpandedRecurringEvents(
                self.user, stmt, start, end, searchQuery, self.session
            )
            if i.id not in recurringEventInstanceIds
        ]

        # 3) Merge the two
        allEvents = heapq.merge(recurringEvents, singleEvents, key=lambda event: event.start)

        return allEvents

    def _updateEventParticipants(
        self,
        userCalendar: UserCalendar,
        event: Event,
        newParticipants: List[EventParticipantVM],
    ) -> None:
        """Create and update event participants.
        I can only modify the attendee that corresponds to this user, or if I'm the organizer.

        Currently defers to google to send invites to new participants.

        TODO: Have option to send invites with Chrono.
        """
        # Permissions check.
        user = userCalendar.account.user
        isOrganizer = event.isOrganizer(userCalendar)
        canModifyEvent = isOrganizer or event.guests_can_modify
        canInviteAttendees = canModifyEvent or event.guests_can_invite_others

        # Add participants, matched with contacts.
        currentAttendeesMap = {p.email: p for p in event.participants}
        newAttendeesMap = set(p.email for p in newParticipants)

        contactRepo = ContactRepository(user, self.session)
        existingContactIds = set()  # Make sure we don't add duplicate contacts

        for participantVM in newParticipants:
            existingContact = contactRepo.findContact(participantVM)
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
        self, calendar: UserCalendar, eventId: str
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
        parentEvent = self.getEvent(calendar, parentId)

        if not parentEvent:
            raise EventNotFoundError(f'Event ID {eventId} not found.')

        eventInDbVM = getRecurringEvent(calendar, eventId, parentEvent)

        return eventInDbVM, parentEvent

    def _updateRecurringEventOverrides(self, userCalendar: UserCalendar, event: Event):
        """Delete the overrides that no longer exist as part of the new recurrence.
        This is done when the user updates a recurring event and changes the recurrence rule.
        """
        if not event.start:
            raise EventRepoError('No start date for recurring event.')

        overrides = (
            self.session.execute(
                BASE_EVENT_STATEMENT.where(
                    Event.recurring_event_id == event.id,
                    Event.recurring_event_calendar_id == event.calendar_id,
                )
            )
            .scalars()
            .all()
        )

        timezone = event.time_zone or userCalendar.timezone or self.user.timezone
        ruleSet = (
            None
            if not event.recurrences
            else recurrenceToRuleSet(
                '\n'.join(event.recurrences), timezone, event.start, event.start_day
            )
        )

        for override in overrides:
            if event.all_day:
                originalStart = override.original_start.replace(tzinfo=None)
            else:
                originalStart = override.original_start

            isInNewRecurrence = (
                False if not ruleSet else ruleSet.after(originalStart, inc=True) == originalStart
            )
            if not isInNewRecurrence:
                logging.info(f'Delete recurring event override: {override} ')
                self.session.delete(override)

    def _populateEventConferenceData(
        self, prevEvent: Event | None, newEvent: EventBaseVM
    ) -> EventBaseVM:
        """Creates or updates conference data for the event and returns a new event with the updated conference data.
        This needs to be done before creating or updating the event in the database.

        If the event has conferencing solutions that are supported by Chrono
        but not by Google Calendar, we need to create the conference data manually.

        1) New event has conference data.
        - Create the new zoom conference data for new event.
        - Update the current event's linked zoom conference data

        2) Current event has managed conference data.
        - Delete the current event's linked zoom conference data if it's a different meeting.
        """

        def createZoomMeetingProperties(conferenceId: str):
            return {
                'private': {
                    'chrono_conference': json.dumps(
                        {
                            'type': ChronoConferenceType.Zoom.value,
                            'id': conferenceId,
                        }
                    )
                }
            }

        # 1) New event with new conference data.
        isManagedZoomMeet = (
            newEvent.conference_data is not None
            and newEvent.conference_data.type == ChronoConferenceType.Zoom
        )
        if isManagedZoomMeet:
            assert newEvent.conference_data  # for type check

            createZoomMeeting = newEvent.conference_data.create_request is not None
            updateZoomMeeting = newEvent.conference_data.conference_id is not None
            logging.info(f'{updateZoomMeeting=}')

            updatedExtendedProperties = newEvent.extended_properties or {}
            if createZoomMeeting:
                conferenceDataVM = self._createConferenceData(newEvent)
                assert conferenceDataVM.conference_id, 'Invalid conference data.'

                # Store the conference data in the extended properties.
                zoomProperties = createZoomMeetingProperties(conferenceDataVM.conference_id)
                updatedExtendedProperties = updatedNestedDict(
                    updatedExtendedProperties, zoomProperties
                )
                newEvent = newEvent.model_copy(
                    update={
                        'conference_data': conferenceDataVM,
                        'extended_properties': updatedExtendedProperties,
                    }
                )

            elif updateZoomMeeting:
                updatedMeetingId = self._updateConferenceData(newEvent)
                if updatedMeetingId:
                    zoomProperties = createZoomMeetingProperties(updatedMeetingId)
                    updatedExtendedProperties = updatedNestedDict(
                        updatedExtendedProperties, zoomProperties
                    )
                    newEvent = newEvent.model_copy(
                        update={'extended_properties': updatedExtendedProperties}
                    )

        elif prevEvent:
            # Remove the existing event's private properties if it has been removed.
            # Need to copy the extended properties to a new dict to avoid SQLAlchemy errors.
            existingProperties = (
                json.loads(json.dumps(dict(prevEvent.extended_properties or {}))) or {}
            )
            if existingProperties.get('private', {}).get('chrono_conference'):
                del existingProperties['private']['chrono_conference']

            newEvent = newEvent.model_copy(update={'extended_properties': existingProperties})

        # 2) Prev event with managed Zoom meeting: Delete if it's a different meeting.
        if prevEvent and prevEvent.conference_data:
            newConferenceId = (
                newEvent.conference_data.conference_id
                if (newEvent and newEvent.conference_data)
                else None
            )

            deletePreviousZoomMeeting = (
                prevEvent.conference_data.conference_id is not None
                and prevEvent.conference_data.type == ChronoConferenceType.Zoom
                and prevEvent.conference_data.conference_id != newConferenceId
            )
            if deletePreviousZoomMeeting:
                self._deleteConferenceData(prevEvent)

        return newEvent

    def _createConferenceData(self, event: EventBaseVM) -> ConferenceDataBaseVM:
        assert (
            event.conference_data
            and event.conference_data.create_request
            and event.conference_data.type == ChronoConferenceType.Zoom
        ), 'Invalid conference data.'

        if not self.zoomAPI:
            raise EventRepoError('User does not have a Zoom connection.')

        zoomMeeting = self.zoomAPI.createMeeting(
            ZoomMeetingInput(
                topic=event.title or '',
                agenda=event.description or '',
                start_time=event.start.isoformat(),
                duration=int((event.end - event.start).total_seconds() / 60),
            )
        )

        conferenceDataVM = ConferenceDataBaseVM(
            conference_solution=ConferenceSolutionVM(
                name='Zoom',
                key_type=ConferenceKeyType.ADD_ON,
                icon_uri=ZOOM_IMAGE,
            ),
            entry_points=[
                EntryPointBaseVM(
                    entry_point_type=CommunicationMethod.VIDEO,
                    uri=zoomMeeting.join_url,
                    label=zoomMeeting.join_url.replace('https://', ''),
                    meeting_code=str(zoomMeeting.id),
                    password=zoomMeeting.password,
                )
            ],
            conference_id=str(zoomMeeting.id),
            create_request=None,
            type=ChronoConferenceType.Zoom,
        )

        return conferenceDataVM

    def _updateConferenceData(self, event: EventBaseVM) -> str | None:
        """Updates the conference data for the event if it is a Zoom meeting that we manage.

        Returns:
            - The updated Zoom meeting ID if the meeting was updated.
        """
        if not self.zoomAPI:
            return None

        zoomMeetingId = None
        if event.conference_data:
            zoomMeetingId = (
                event.conference_data.conference_id
                if event.conference_data.conference_id
                and event.conference_data.type == ChronoConferenceType.Zoom
                else None
            )

            if zoomMeetingId is not None:
                try:
                    self.zoomAPI.updateMeeting(
                        zoomMeetingId,
                        ZoomMeetingInput(
                            topic=event.title or '',
                            agenda=event.description or '',
                            start_time=event.start.isoformat(),
                            duration=int((event.end - event.start).total_seconds() / 60),
                        ),
                    )
                except Exception as e:
                    # Event could have already been deleted from Zoom.
                    logging.error(f'Error updating Zoom meeting: {e}')

        return zoomMeetingId

    def _deleteConferenceData(self, event: Event):
        """Deletes the conference data for the event if it is a Zoom meeting that we manage.
        Do nothing if there is no access to the Zoom API as the user could have unlinked their zoom account.
        """
        if not self.zoomAPI:
            return

        if event.conference_data:
            zoomMeetingId = (
                event.conference_data.conference_id
                if event.conference_data.conference_id
                and event.conference_data.type == ChronoConferenceType.Zoom
                else None
            )

            if zoomMeetingId is not None:
                try:
                    self.zoomAPI.deleteMeeting(zoomMeetingId)
                except Exception as e:
                    # Event could have already been deleted from Zoom.
                    logging.info(f'Error deleting Zoom meeting: {e}')


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
    eventVM: EventBaseVM,
) -> Event:
    """Overrides a recurring event as a deleted event."""
    assert eventVM.original_start

    googleId = None
    if parentEvent.recurring_event_gId:
        googleId = getRecurringEventId(
            parentEvent.recurring_event_gId, eventVM.original_start, parentEvent.all_day
        )

    event = Event(
        googleId,
        None,
        None,
        eventVM.start,
        eventVM.end,
        None,
        None,
        None,
        None,
        eventVM.original_start,
        eventVM.original_start.strftime('%Y-%m-%d') if parentEvent.all_day else None,
        parentEvent.time_zone,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        True,
        [],
        overrideId=eventVM.id,
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
        dt = (
            datetime.strptime(datePart, "%Y%m%d")
            if parentEvent.all_day
            else datetime.strptime(datePart, "%Y%m%dT%H%M%SZ")
        )

        for e in getExpandedRecurringEvents(calendar.account.user, parentEvent, {}, dt, dt):
            if e.id == eventId:
                return e

        raise InputError(f'Invalid Event ID: {eventId}')

    except ValueError:
        raise InputError(f'Invalid Event ID {eventId}')


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
        and_(Event.recurrences != None, Event.recurrences != []),
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
        evt = EventInDBVM.model_validate(eventOverride)
        yield evt

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
    assert baseRecurringEvent.start and baseRecurringEvent.end

    duration = baseRecurringEvent.end - baseRecurringEvent.start
    isAllDay = baseRecurringEvent.all_day
    baseEventVM = GoogleEventInDBVM.model_validate(baseRecurringEvent)
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

                        eventVM = GoogleEventInDBVM.model_validate(eventOverride)
                        eventVM.calendar_id = userCalendar.id  # TODO: Remove this

                        yield eventVM
                else:
                    eventVM = baseEventVM.model_copy(
                        update={
                            'id': eventId,
                            'google_id': getRecurringEventId(
                                baseEventVM.google_id, start, isAllDay
                            ),
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


def getRecurringEventId(
    baseEventId: Optional[str], startDate: datetime, isAllDay: bool
) -> Optional[str]:
    """Returns a composite ID for the recurring event, based on the original
    event ID and the start date.
    """
    if not baseEventId:
        return None

    dtStr = startDate.astimezone(ZoneInfo('UTC')).strftime(
        "%Y%m%d" if isAllDay else "%Y%m%dT%H%M%SZ"
    )
    return f'{baseEventId}_{dtStr}'


def createOrUpdateEvent(
    userCalendar: UserCalendar,
    eventDb: Optional[Event],
    eventVM: EventBaseVM,
    overrideId: Optional[str] = None,
    googleId: Optional[str] = None,
) -> Event:
    """Create a new event or update (PUT) an existing event by copying the properties from the view model
    to the event model.
    """
    recurrences = None if eventVM.recurring_event_id else eventVM.recurrences

    if creatorVM := eventVM.creator:
        creator = EventCreator(creatorVM.email, creatorVM.display_name, creatorVM.contact_id)
    else:
        creator = EventCreator(userCalendar.account.email, None, None)

    if organizerVM := eventVM.organizer:
        organizer = EventOrganizer(
            organizerVM.email, organizerVM.display_name, organizerVM.contact_id
        )
    else:
        organizer = EventOrganizer(userCalendar.email, userCalendar.summary, None)

    conferenceData = createConferenceData(eventVM.conference_data)

    reminders = (
        [
            ReminderOverride(reminderVM.method, reminderVM.minutes)
            for reminderVM in eventVM.reminders
        ]
        if eventVM.reminders
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
            eventVM.guests_can_modify,
            eventVM.guests_can_invite_others,
            eventVM.guests_can_see_other_guests,
            conferenceData,
            eventVM.location,
            eventVM.use_default_reminders,
            reminders,
            visibility=eventVM.visibility,
            transparency=eventVM.transparency,
            status=eventVM.status,
            recurringEventId=eventVM.recurring_event_id,
            recurringEventCalendarId=userCalendar.id,
            overrideId=overrideId,
            extendedProperties=eventVM.extended_properties,
        )

        userCalendar.calendar.events.append(event)

        return event
    else:
        if googleId:
            eventDb.google_id = googleId

        eventDb.title = eventVM.title or ""
        eventDb.description = eventVM.description
        eventDb.start = eventVM.start
        eventDb.end = eventVM.end
        eventDb.start_day = eventVM.start_day
        eventDb.end_day = eventVM.end_day
        eventDb.time_zone = eventVM.timezone
        eventDb.recurring_event_id = eventVM.recurring_event_id
        eventDb.recurring_event_calendar_id = userCalendar.id

        if recurrences is not None:
            eventDb.recurrences = recurrences

        eventDb.guests_can_modify = eventVM.guests_can_modify
        eventDb.guests_can_invite_others = eventVM.guests_can_invite_others
        eventDb.guests_can_see_other_guests = eventVM.guests_can_see_other_guests

        eventDb.conference_data = conferenceData
        eventDb.location = eventVM.location

        if not eventDb.creator:
            eventDb.creator = creator

        eventDb.organizer = organizer
        eventDb.status = eventVM.status

        eventDb.visibility = eventVM.visibility
        eventDb.transparency = eventVM.transparency

        if eventVM.use_default_reminders is not None:
            eventDb.use_default_reminders = eventVM.use_default_reminders

        if reminders is not None:
            eventDb.reminders = reminders

        eventDb.extended_properties = eventVM.extended_properties

        return eventDb


def createConferenceData(conferenceDataVM: ConferenceDataBaseVM | None) -> ConferenceData | None:
    conferenceData = None

    if conferenceDataVM:
        conferenceData = ConferenceData(
            conferenceDataVM.conference_id,
            (
                ConferenceSolution(
                    conferenceDataVM.conference_solution.name,
                    conferenceDataVM.conference_solution.key_type,
                    conferenceDataVM.conference_solution.icon_uri,
                )
                if conferenceDataVM.conference_solution
                else None
            ),
            conferenceDataVM.type,
        )
        conferenceData.entry_points = [
            ConferenceEntryPoint(
                entryPointVM.entry_point_type,
                entryPointVM.uri,
                entryPointVM.label,
                entryPointVM.meeting_code,
                entryPointVM.password,
            )
            for entryPointVM in conferenceDataVM.entry_points
        ]

        if conferenceDataVM.create_request:
            conferenceData.create_request = ConferenceCreateRequest(
                conferenceDataVM.create_request.status,
                conferenceDataVM.create_request.request_id,
                conferenceDataVM.create_request.conference_solution_key_type,
            )

    return conferenceData


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


def updatedNestedDict(data1: dict, data2: dict):
    """Updates nested dictionaries without overwriting existing values."""
    """Merges two JSON objects where the values within a common key are also JSON objects."""
    result = data1.copy()

    for key, value in data2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = updatedNestedDict(result[key], value)  # Recurse if nested dictionaries
        else:
            result[key] = value

    return result
