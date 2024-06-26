import uuid
import pytest
import json
from unittest.mock import MagicMock, patch

from datetime import datetime, timedelta


from app.db.repos.event_repo.view_models import (
    EventBaseVM,
    EventParticipantVM,
    ConferenceDataBaseVM,
    CreateConferenceRequestVM,
    ConferenceKeyType,
    ConferenceCreateStatus,
    ConferenceSolutionVM,
)
from app.db.repos.exceptions import EventRepoPermissionError
from app.db.repos.calendar_repo import CalendarRepository

from tests.utils import createEvent, createCalendar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.repos.event_repo.event_repo import (
    EventRepository,
    getRecurringEvent,
    InputError,
    getAllExpandedRecurringEventsList,
    eventMatchesQuery,
    EventRepoError,
    EventNotFoundError,
    getRecurringEventId,
)
from app.db.repos.event_repo.event_repo import (
    createOrUpdateEvent,
)

from app.db.models import Event, User
from app.db.models.event_participant import EventAttendee, EventOrganizer
from app.db.models.conference_data import ChronoConferenceType

from app.utils.zoom import ZoomAPI


def test_event_repo_search(user: User, session: Session):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    createEvent(calendar, start, end, title='Blueberry Pear')
    createEvent(calendar, start, end, title='Pear Grape')
    createEvent(calendar, start, end, title='Apple Banana')
    session.commit()

    eventRepo = EventRepository(user, session)
    events = list(eventRepo.search("Pear", start - timedelta(days=30), start + timedelta(days=30)))

    assert len(events) == 2
    assert all(e.title and 'Pear' in e.title for e in events)


def test_event_repo_search_recurring(user: User, session: Session):
    """Assure we can search instances of a recurring event."""
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    # 1) Create an individual event with the search term "Pear"
    createEvent(calendar, start - timedelta(days=1), end, title='Blueberry Pear')

    # 2) Create a new recurring event 2020-01-01 to 2020-01-05 with the search term.
    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(
        calendar, start, start + timedelta(hours=1), title="Recurring Pear"
    )
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z']

    # Override one of the events so that it DOES NOT have the search term anymore.
    # A search for "Pear" should not return the overriden result.
    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=10), session
    )

    event = createOrUpdateEvent(calendar, None, events[1])
    event.title = 'Recurring Override with Pear'
    event.id = events[1].id

    event = createOrUpdateEvent(calendar, None, events[2])
    event.title = 'Recurring Override'
    event.id = events[2].id

    # Create another recurring event (not searched)
    recurringEvent = createEvent(
        calendar, start, start + timedelta(hours=1), title="Another Recurring"
    )
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z']

    session.commit()

    # Search "Pear". Makes sure we get results from both:
    # 1) The individual event
    # 2) The recurring events, except the overriden event
    eventRepo = EventRepository(user, session)
    events = list(eventRepo.search("Pear", start - timedelta(days=30), start + timedelta(days=30)))

    assert len(events) == 5
    assert events[0].title == 'Blueberry Pear'
    assert events[1].title == 'Recurring Pear'
    assert events[2].title == 'Recurring Override with Pear'
    assert events[3].title == 'Recurring Pear'
    assert events[4].title == 'Recurring Pear'


"""Tests CRUD operations for events"""


def test_event_repo_CRUD(user: User, session: Session):
    """Tests a CRUD flow for events.

    1) Create Event
    2) Get Event
    3) Update Event
    """
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    startDay = '2020-12-25'
    endDay = '2020-12-26'
    timezone = 'America/Los_Angeles'
    organizer = EventParticipantVM(email='user@chrono.so', display_name='Event Organizer')
    eventVM = EventBaseVM(
        title='Event',
        description='Test event description',
        start=datetime.strptime(startDay, "%Y-%m-%d"),
        end=datetime.strptime(endDay, "%Y-%m-%d"),
        start_day=startDay,
        end_day=endDay,
        calendar_id=userCalendar.id,
        time_zone=timezone,
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
        organizer=organizer,
    )

    eventRepo = EventRepository(user, session)

    # 1) Create Event
    event = eventRepo.createEvent(userCalendar, eventVM)
    session.add(event)
    session.commit()

    assert event.title == eventVM.title
    assert event.creator and event.creator.email == user.email
    assert event.organizer and event.organizer.email == organizer.email

    # 2) Get Event
    eventDB = eventRepo.getEvent(userCalendar, event.id)
    assert eventDB

    event = eventDB
    assert event.title == eventVM.title
    assert event.calendar.id == userCalendar.id

    eventVM = EventBaseVM.model_validate(event)
    eventVM.organizer = EventParticipantVM(email='new-email@chrono.so')
    eventVM.description = "new description"

    # 3) Update Event
    updatedEventVM = eventRepo.updateEvent(userCalendar, event.id, eventVM)
    session.commit()

    assert updatedEventVM.organizer and updatedEventVM.organizer.email == eventVM.organizer.email
    assert updatedEventVM.description == eventVM.description


def test_event_repo_edit_permissions(user: User, session: Session):
    """Tests that we can't edit an event if we don't have permission."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Creates an event. The user is not the organizer.
    # That means the event is duplicated on this calendar and not editable.
    event = createEvent(
        userCalendar, datetime.now(), datetime.now() + timedelta(hours=1), title='Event'
    )
    event.organizer = EventOrganizer('other@chrono.so', None, None)
    session.commit()

    eventRepo = EventRepository(user, session)
    eventVM = eventRepo.getEventVM(userCalendar, event.id)
    assert eventVM is not None

    # Try to update the event. Should fail if modifying main event fields.
    eventVMUpdated = eventVM.model_copy(update={'title': "new summary"})
    with pytest.raises(EventRepoPermissionError):
        eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)

    eventVMUpdated = eventVM.model_copy(update={'description': "new description"})
    with pytest.raises(EventRepoPermissionError):
        eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)

    eventVMUpdated = eventVM.model_copy(update={'start': eventVM.start + timedelta(hours=1)})
    with pytest.raises(EventRepoPermissionError):
        eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)

    eventVMUpdated = eventVM.model_copy(update={'end': eventVM.end + timedelta(hours=1)})
    with pytest.raises(EventRepoPermissionError):
        eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)


def test_event_repo_edit_attendee_permissions_as_guest(user: User, session: Session):
    """Tests edit event attendees when the user is not the organizer."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    event = createEvent(
        userCalendar, datetime.now(), datetime.now() + timedelta(hours=1), title='Event'
    )
    event.participants = [
        EventAttendee('p1@chrono.so', None, None, 'needsAction'),
        EventAttendee('p2@chrono.so', None, None, 'needsAction'),
        EventAttendee(user.email, None, None, 'needsAction'),
    ]
    event.organizer = EventOrganizer('other@chrono.so', None, None)
    event.guests_can_invite_others = False
    session.commit()

    eventRepo = EventRepository(user, session)
    eventVM = eventRepo.getEventVM(userCalendar, event.id)
    assert eventVM is not None

    # Make sure this user can update their own responseStatus.
    newParticipants = [
        p.model_copy(update={'response_status': 'accepted'}) if p.email == user.email else p
        for p in eventVM.participants
    ]
    eventVMUpdated = eventVM.model_copy(update={'participants': newParticipants})
    event = eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)
    participant = next(p for p in event.participants if p.email == user.email)
    assert participant.response_status == 'accepted'

    # Make sure this user doesn't have the permissions to update the guest list.
    newParticipants = [
        p.model_copy(update={'response_status': 'accepted'}) for p in eventVM.participants
    ]
    eventVMUpdated = eventVM.model_copy(update={'participants': newParticipants})
    event = eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)
    participantsMap = {p.email: p for p in event.participants}

    assert participantsMap['p1@chrono.so'].response_status == 'needsAction'
    assert participantsMap['p2@chrono.so'].response_status == 'needsAction'
    assert participantsMap[user.email].response_status == 'accepted'

    # Make sure we can't add a new participant.
    newParticipants.append(EventParticipantVM(email='p3@chrono.so'))
    with pytest.raises(EventRepoPermissionError):
        eventRepo.updateEvent(
            userCalendar,
            event.id,
            eventVM.model_copy(update={'participants': newParticipants}),
        )

    # Make sure we can add a new participant if guests_can_invite_others is True.
    event.guests_can_invite_others = True
    session.add(event)
    session.commit()

    eventVM = eventRepo.getEventVM(userCalendar, event.id)
    assert eventVM is not None

    event = eventRepo.updateEvent(
        userCalendar, event.id, eventVM.model_copy(update={'participants': newParticipants})
    )
    assert len(event.participants) == 4
    participantsMap = {p.email: p for p in event.participants}
    assert participantsMap['p3@chrono.so'].response_status == 'needsAction'

    # Cannot remove participants
    del participantsMap['p1@chrono.so']
    removedParticipants = [p for p in participantsMap.values()]
    event = eventRepo.updateEvent(
        userCalendar,
        event.id,
        eventVM.model_copy(update={'participants': removedParticipants}),
    )
    assert len(event.participants) == 4


def test_event_repo_edit_attendee_permissions_as_organizer(user: User, session: Session):
    """Tests edit event attendees when the user is the organizer."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    event = createEvent(
        userCalendar, datetime.now(), datetime.now() + timedelta(hours=1), title='Event'
    )
    event.participants = [
        EventAttendee('p1@chrono.so', None, None, 'needsAction'),
        EventAttendee('p2@chrono.so', None, None, 'needsAction'),
        EventAttendee(user.email, None, None, 'needsAction'),
    ]
    event.organizer = EventOrganizer(user.email, None, None)
    session.commit()

    eventRepo = EventRepository(user, session)
    eventVM = eventRepo.getEventVM(userCalendar, event.id)
    assert eventVM is not None

    # We can add a new participant
    newParticipants = eventVM.participants
    newParticipants.append(EventParticipantVM(email='p3@chrono.so', response_status='tentative'))
    eventVMUpdated = eventVM.model_copy(update={'participants': newParticipants})

    event = eventRepo.updateEvent(userCalendar, event.id, eventVMUpdated)
    participantsMap = {p.email: p for p in event.participants}
    assert len(event.participants) == 4
    assert participantsMap['p3@chrono.so'].response_status == 'tentative'

    # We can remove participants
    del participantsMap['p1@chrono.so']
    del participantsMap['p2@chrono.so']

    removedParticipants = [p for p in participantsMap.values()]
    event = eventRepo.updateEvent(
        userCalendar,
        event.id,
        eventVM.model_copy(update={'participants': removedParticipants}),
    )
    assert len(event.participants) == 2
    participantsMap = {p.email: p for p in event.participants}
    assert 'p1@chrono.so' not in participantsMap
    assert 'p2@chrono.so' not in participantsMap


def test_event_repo_delete(user: User, session: Session):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    e1 = createEvent(userCalendar, start, end, title='Blueberry Pear')
    session.commit()

    eventRepo = EventRepository(user, session)

    event = eventRepo.getEvent(userCalendar, e1.id)
    assert event is not None
    assert event.status == 'active'

    eventRepo.deleteEvent(userCalendar, e1.id)

    event = eventRepo.getEvent(userCalendar, e1.id)
    assert event is not None
    assert event.status == 'deleted'


"""Tests for Recurring Events"""


def test_event_repo_deleteRecurring(user: User, session: Session):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    session.commit()

    eventRepo = EventRepository(user, session)

    # 1) Delete Event Normally
    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-02T12:00:00'), False
    )
    assert eventId

    eventVM = eventRepo.getEventVM(userCalendar, eventId)
    assert eventVM

    eventRepo.deleteEvent(userCalendar, eventVM.id)
    session.commit()

    # 2) Delete Event Twice
    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-03T12:00:00'), False
    )
    assert eventId

    eventVM = eventRepo.getEventVM(userCalendar, eventId)
    assert eventVM

    eventRepo.deleteEvent(userCalendar, eventVM.id)
    eventRepo.deleteEvent(userCalendar, eventVM.id)
    session.commit()
    event = eventRepo.getEvent(userCalendar, recurringEvent.id)

    # 3) Override then delete event
    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-04T12:00:00'), False
    )
    assert eventId

    eventVM = eventRepo.getEventVM(userCalendar, eventId)
    assert eventVM

    eventVM.title = 'override'
    eventRepo.updateEvent(userCalendar, eventVM.id, eventVM)
    eventRepo.deleteEvent(userCalendar, eventVM.id)
    session.commit()


def test_event_repo_getRecurringEventWithParent(user: User, session: Session):
    """Make sure we can fetch an instance of a recurring event and its parent."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    session.commit()

    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-02T12:00:00'), False
    )
    assert eventId

    eventRepo = EventRepository(user, session)
    event, parent = eventRepo.getRecurringEventWithParent(userCalendar, eventId)

    assert event.recurring_event_id == parent.id
    assert parent.id == recurringEvent.id


def test_event_repo_getRecurringEvent(user: User, session: Session):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    session.commit()

    # Assert that getRecurringEvent raises exceptions if the ID is invalid.
    validEventId = f'{recurringEvent.id}_20201202T120000Z'
    invalidEventId1 = f'{recurringEvent.id}_1212'
    invalidEventId2 = f'{recurringEvent.id}_20211202T120000Z'

    # Re-query to merge with labels joined.
    recurringEvent2 = (session.execute(select(Event).where(Event.id == recurringEvent.id))).scalar()

    assert recurringEvent2

    getRecurringEvent(userCalendar, validEventId, recurringEvent2)

    with pytest.raises(InputError):
        getRecurringEvent(userCalendar, invalidEventId1, recurringEvent2)

    with pytest.raises(InputError):
        getRecurringEvent(userCalendar, invalidEventId2, recurringEvent2)


def test_event_repo_getRecurringEvent_all_day(user: User, session: Session):
    """Makes sure we can get fetch an all day recurring event"""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    startDay = '2020-01-01'
    endDay = '2020-01-02'
    eventVM = EventBaseVM(
        title='Foo',
        description='Bar',
        start=datetime.strptime(startDay, "%Y-%m-%d"),
        end=datetime.strptime(endDay, "%Y-%m-%d"),
        start_day=startDay,
        end_day=endDay,
        calendar_id=userCalendar.id,
        time_zone='America/Los_Angeles',
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
    )

    parentEvent = createOrUpdateEvent(userCalendar, None, eventVM)
    session.commit()

    # Get the first instance of the recurring event.
    recurringEventId = f'{parentEvent.id}_20200105'
    event = getRecurringEvent(userCalendar, recurringEventId, parentEvent)

    assert event
    assert event.all_day
    assert event.recurring_event_id == parentEvent.id


def test_event_repo_getAllExpandedRecurringEvents_override(user: User, session: Session):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new recurring event. 01-02 to 01-07 => 6 events
    start = datetime.fromisoformat('2020-01-02T12:00:00')
    baseEvent = createEvent(
        calendar,
        start,
        start + timedelta(hours=1),
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20200107T120000Z'],
    )

    # Expanded recurring events between 2 dates.
    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    assert len(events) == 2
    assert events[0].original_start == events[0].start

    # Expand all events.
    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=10), session
    )
    assert len(events) == 6

    delta = events[1].start - events[0].start
    assert delta.days == 1

    # Override one recurring event and ensure that it's updated.
    event = createOrUpdateEvent(calendar, None, events[1])
    event.title = 'Override'
    event.id = events[1].id

    session.add(event)
    session.commit()

    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )

    assert events[0].title == baseEvent.title
    assert events[1].title == 'Override'


def test_event_repo_getAllExpandedRecurringEvents_fullDay(user: User, session: Session):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    startDay = '2020-12-25'
    endDay = '2020-12-26'
    timezone = 'America/Los_Angeles'
    eventVM = EventBaseVM(
        title='Event',
        description='Test event description',
        start=datetime.strptime(startDay, "%Y-%m-%d"),
        end=datetime.strptime(endDay, "%Y-%m-%d"),
        start_day=startDay,
        end_day=endDay,
        calendar_id=userCalendar.id,
        time_zone=timezone,
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
    )

    start = datetime.strptime(startDay, "%Y-%m-%d")
    createOrUpdateEvent(userCalendar, None, eventVM)
    session.commit()

    recurringEvents = getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=100), session
    )

    firstStart = datetime.strptime('2020-12-27', "%Y-%m-%d")
    for idx, e in enumerate(recurringEvents):
        expectedStart = firstStart + timedelta(days=7 * idx)
        assert e.start_day == expectedStart.strftime('%Y-%m-%d')
        expectedEnd = expectedStart + timedelta(days=1)
        assert e.end_day == expectedEnd.strftime('%Y-%m-%d')


def test_event_repo_getAllExpandedRecurringEvents_withTimezone(user, session):
    # TODO: Test expansions with timezone info in EXDate
    recurrences = [
        'EXDATE;TZID=America/Toronto:20201019T213000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
    ]


def test_event_repo_updateEvent_recurring(user: User, session: Session):
    """Move recurring event to outside a range."""
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new recurring event. 01-02 to 01-07 => 6 events
    start = datetime.fromisoformat('2022-01-02T12:00:00')
    parentEvent = createEvent(
        calendar,
        start,
        start + timedelta(hours=1),
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20220107T120000Z'],
    )

    # 1) Override single recurring events
    # Makes sure expanded events have the new title.

    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    assert len(events) == 2
    assert [e.title for e in events] == [parentEvent.title, parentEvent.title]

    eventRepo = EventRepository(user, session)
    overrideEvent = events[0]
    overrideEvent.title = 'foo'

    event = eventRepo.updateEvent(calendar, overrideEvent.id, overrideEvent)
    assert event.title == overrideEvent.title

    overrideEvent = events[1]
    overrideEvent.title = 'bar'
    event = eventRepo.updateEvent(calendar, overrideEvent.id, overrideEvent)
    assert event.title == overrideEvent.title

    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    assert len(events) == 2
    assert [e.title for e in events] == ['foo', 'bar']

    # 2) Override the parent recurring event. Moves the end date forward by 1h.
    # Makes sure all overrides are kept, since the new range includes these events.

    parentEventVM = eventRepo.getEventVM(calendar, parentEvent.id)
    assert parentEventVM is not None

    parentEvent.end = parentEventVM.end + timedelta(hours=1)

    event = eventRepo.updateEvent(calendar, parentEventVM.id, parentEventVM)
    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )

    assert len(events) == 2
    assert [e.title for e in events] == ['foo', 'bar']

    # 3) Remove the recurrence rule from the parent event.
    # Makes sure all overrides are deleted, since the new range excludes these events.

    updatedParentVM = parentEventVM.model_copy(update={'recurrences': []})
    event = eventRepo.updateEvent(calendar, parentEventVM.id, updatedParentVM)
    session.commit()

    eventResult = list(
        eventRepo.getEventsInRange(calendar.id, start, start + timedelta(days=1), 10)
    )

    assert len(eventResult) == 1
    assert eventResult[0].id == parentEvent.id


def test_event_repo_updateEvent_this_and_following(user: User, session: Session):
    """Updates this & following events.

    This creates two new parent events.
    We make sure the override is kept for the first parent event.
    """
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    """1) Create a new recurring event. 01-02 to 01-07 => 6 events"""

    start = datetime.fromisoformat('2022-01-02T12:00:00')
    parentEvent = createEvent(
        calendar,
        start,
        start + timedelta(hours=1),
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20220107T120000Z'],
        timezone='America/Los_Angeles',
    )

    """2) Override recurring events."""

    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=10), session
    )
    eventRepo = EventRepository(user, session)

    # This event should be kept by the update.
    overrideEvent = events[0]
    overrideEvent.title = 'foo'
    overrideEvent.start = overrideEvent.start + timedelta(hours=1)
    eventRepo.updateEvent(calendar, overrideEvent.id, overrideEvent)

    # This event should be removed by the update.
    overrideEvent2 = events[4]
    overrideEvent2.title = 'bar'
    eventRepo.updateEvent(calendar, overrideEvent2.id, overrideEvent2)

    """3) Update the parent event's recurrence.
    It will be cut off at 01-03 (two events)
    """

    parentEventVM = eventRepo.getEventVM(calendar, parentEvent.id)
    assert parentEventVM

    parentEventVM.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20220103T120000Z']
    eventRepo.updateEvent(calendar, parentEventVM.id, parentEventVM)

    events = getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=10), session
    )

    assert len(events) == 2
    # Make sure the override is kept.
    assert events[0].title == 'foo'

    # Make sure the override is deleted.
    with pytest.raises(InputError):
        eventRepo.getEventVM(calendar, overrideEvent2.id)


"""Test Move Events"""


def test_event_repo_moveEvent(user: User, session: Session):
    """Moved the event from one calendar to another and make sure
    we've updated the association table.
    """
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new calendar

    userCalendar2 = createCalendar(user, uuid.uuid4())

    # Create an event in the first calendar.
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)
    evt = createEvent(userCalendar, start, end, title='Do stuff')
    session.add(evt)
    session.commit()
    eventId = evt.id

    # Move the event to second calendar.
    eventRepo = EventRepository(user, session)

    event = eventRepo.getEvent(userCalendar, eventId)
    assert event is not None

    eventRepo.moveEvent(eventId, userCalendar.id, userCalendar2.id)

    # Ensure it exists in the new calendar
    event = eventRepo.getEvent(userCalendar, eventId)
    assert event is None

    event = eventRepo.getEvent(userCalendar2, eventId)
    assert event and event.id == eventId


def test_event_repo_moveEvent_recurring(user: User, session: Session):
    """Moved the event from one calendar to another.
    Makes sure all the recurring events instances are expanded.
    """
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new calendar
    userCalendar2 = createCalendar(user, uuid.uuid4())

    # Create an event in the first calendar.
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)
    event = createEvent(
        userCalendar,
        start,
        end,
        title='Do stuff',
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20200107T120000Z'],
    )
    session.add(event)
    session.commit()
    baseEventId = event.id

    # Make sure we can't move an instance of a recurring event.
    events = getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=1), session
    )
    eventInstanceId = events[0].id
    eventRepo = EventRepository(user, session)

    with pytest.raises(EventRepoError):
        eventRepo.moveEvent(eventInstanceId, userCalendar.id, userCalendar2.id)

    # Move the base event to second calendar.
    eventRepo.moveEvent(baseEventId, userCalendar.id, userCalendar2.id)

    with pytest.raises(EventNotFoundError):
        event2 = eventRepo.getEventVM(userCalendar, eventInstanceId)

    event2 = eventRepo.getEventVM(userCalendar2, eventInstanceId)

    assert event2
    assert event2.id == eventInstanceId


def test_event_repo_eventMatchesQuery(user: User, session: Session):
    """TODO: Test that the OR filters match results given from a full text Postgres search."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)
    event = createEvent(
        userCalendar,
        start,
        end,
        title='First Second',
    )
    assert eventMatchesQuery(event, "First")
    assert eventMatchesQuery(event, "Foo | second")


def test_event_repo_populateEventConferenceData(user: User, session: Session):
    """Tests populating an event with conference data.
    Ensure that existing extended_properties are not overwritten.
    """

    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # 1) We have an existing event with extended properties.
    event = createEvent(
        userCalendar,
        datetime.now(),
        datetime.now() + timedelta(hours=1),
        title='Event',
    )
    event.extended_properties = {'private': {'foo': 'bar'}}
    session.commit()

    eventRepo = EventRepository(user, session)
    eventVM = eventRepo.getEventVM(userCalendar, event.id)

    assert eventVM
    assert eventVM.conference_data is None

    # 2) Add conferencing data to the event.
    eventVM.conference_data = ConferenceDataBaseVM(
        conference_id=None,
        conference_solution=None,
        entry_points=[],
        type=ChronoConferenceType.Zoom,
        create_request=CreateConferenceRequestVM(
            conference_solution_key_type=ConferenceKeyType.ADD_ON,
            status=ConferenceCreateStatus.PENDING,
        ),
    )

    zoomAPIMock, createdZoomMeeting = _createMockZoomAPI()
    zoomAPIMock.createMeeting.return_value = createdZoomMeeting
    eventRepo.zoomAPI = zoomAPIMock

    # 3) Ensure we add conference data to the extended properties and that existing
    # properties are not overwritten.
    updatedEventVM = eventRepo._populateEventConferenceData(event, eventVM)

    assert updatedEventVM.extended_properties
    assert updatedEventVM.extended_properties['private']['foo'] == 'bar'
    assert updatedEventVM.extended_properties['private']['chrono_conference']

    conferenceData = json.loads(updatedEventVM.extended_properties['private']['chrono_conference'])
    assert conferenceData['type'] == 'zoom'
    assert conferenceData['id'] == str(createdZoomMeeting.id)

    # 4) Remove conference data from the event.
    # Ensure that the extended properties are removed.

    updatedEventVM = eventRepo._populateEventConferenceData(
        event, updatedEventVM.model_copy(update={'conference_data': None})
    )

    assert updatedEventVM.extended_properties == {'private': {'foo': 'bar'}}


def test_event_repo_createConferenceData(user: User, session: Session):
    """Makes sure the Zoom API is called to create a meeting
    when we have a zoom typed conference data with a create request.
    """
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    eventVM = _createTestEventVM(userCalendar.id).model_copy(
        update={
            'conference_data': ConferenceDataBaseVM(
                conference_id=None,
                conference_solution=None,
                entry_points=[],
                type=ChronoConferenceType.Zoom,
                create_request=CreateConferenceRequestVM(
                    conference_solution_key_type=ConferenceKeyType.ADD_ON,
                    status=ConferenceCreateStatus.PENDING,
                ),
            ),
        }
    )

    eventRepo = EventRepository(user, session)

    # Create a mock ZoomMeeting object to return from the createMeeting method
    zoomAPIMock, createdZoomMeeting = MagicMock(spec=ZoomAPI)
    zoomAPIMock.createMeeting.return_value = createdZoomMeeting
    eventRepo.zoomAPI = zoomAPIMock

    conferenceDataVM = eventRepo._createConferenceData(eventVM)

    assert conferenceDataVM.conference_id == str(createdZoomMeeting.id)
    assert conferenceDataVM.entry_points[0].uri == createdZoomMeeting.join_url
    assert conferenceDataVM.entry_points[0].password == createdZoomMeeting.password


def test_event_repo_deleteConferenceData(user: User, session: Session):
    """Makes sure that the Zoom API is called to delete a meeting."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    zoomMeetingID = 12345
    eventVM = _createTestEventVM(userCalendar.id).model_copy(
        update={
            'conference_data': ConferenceDataBaseVM(
                conference_id=str(zoomMeetingID),
                conference_solution=ConferenceSolutionVM(
                    key_type=ConferenceKeyType.ADD_ON,
                    name='Zoom',
                    icon_uri='https://example.com/icon.png',
                ),
                entry_points=[],
                type=ChronoConferenceType.Zoom,
                create_request=None,
            ),
        }
    )

    eventRepo = EventRepository(user, session)
    zoomAPIMock, _created = _createMockZoomAPI()
    eventRepo.zoomAPI = zoomAPIMock

    eventRepo._deleteConferenceData(eventVM)

    zoomAPIMock.deleteMeeting.assert_called_once_with(zoomMeetingID)


def _createMockZoomAPI():
    zoomAPIMock = MagicMock(spec=ZoomAPI)
    zoomMeetingMock = MagicMock()
    zoomMeetingMock.join_url = 'https://example.com/join'
    zoomMeetingMock.id = 12345
    zoomMeetingMock.password = 'password'
    zoomAPIMock.createMeeting.return_value = zoomMeetingMock

    return zoomAPIMock, zoomMeetingMock


def _createTestEventVM(userCalendarId: uuid.UUID):
    startDay = '2020-12-25'
    endDay = '2020-12-26'

    return EventBaseVM(
        title='Event',
        description='Test event description',
        start=datetime.strptime(startDay, "%Y-%m-%d"),
        end=datetime.strptime(endDay, "%Y-%m-%d"),
        start_day=startDay,
        end_day=endDay,
        calendar_id=userCalendarId,
        time_zone='America/Los_Angeles',
        organizer=EventParticipantVM(email='user@rechrono.com', display_name='Event Organizer'),
    )
