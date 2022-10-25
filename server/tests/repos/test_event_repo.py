import pytest
from datetime import datetime, timedelta
from app.api.repos.exceptions import EventRepoPermissionError
from app.db.models.event_participant import EventAttendee, EventOrganizer
from app.db.models.user_calendar import UserCalendar
from tests.utils import createEvent, createCalendar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Event, User
from app.api.repos.event_repo import (
    EventRepository,
    getRecurringEvent,
    InputError,
    getAllExpandedRecurringEventsList,
    eventMatchesQuery,
    EventRepoError,
    EventNotFoundError,
)
from app.api.repos.event_utils import (
    EventBaseVM,
    EventParticipantVM,
    createOrUpdateEvent,
    getRecurringEventId,
)


@pytest.mark.asyncio
async def test_event_repo_search(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    createEvent(calendar, start, end, title='Blueberry Pear')
    createEvent(calendar, start, end, title='Pear Grape')
    createEvent(calendar, start, end, title='Apple Banana')
    await session.commit()

    eventRepo = EventRepository(session)
    events = list(
        await eventRepo.search(user, "Pear", start - timedelta(days=30), start + timedelta(days=30))
    )

    assert len(events) == 2
    assert all('Pear' in e.title for e in events)


@pytest.mark.asyncio
async def test_event_repo_search_recurring(user, session):
    """Assure we can search instances of a recurring event."""
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
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
    events = await getAllExpandedRecurringEventsList(
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

    await session.commit()

    # Search "Pear". Makes sure we get results from both:
    # 1) The individual event
    # 2) The recurring events, except the overriden event
    eventRepo = EventRepository(session)
    events = list(
        await eventRepo.search(user, "Pear", start - timedelta(days=30), start + timedelta(days=30))
    )

    assert len(events) == 5
    assert events[0].title == 'Blueberry Pear'
    assert events[1].title == 'Recurring Pear'
    assert events[2].title == 'Recurring Override with Pear'
    assert events[3].title == 'Recurring Pear'
    assert events[4].title == 'Recurring Pear'


"""Tests CRUD operations for events"""


@pytest.mark.asyncio
async def test_event_repo_CRUD(user, session):
    """Tests a CRUD flow for events.

    1) Create Event
    2) Get Event
    3) Update Event
    """
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

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
        timezone=timezone,
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
        organizer=organizer,
    )

    eventRepo = EventRepository(session)

    # 1) Create Event
    event = await eventRepo.createEvent(user, userCalendar, eventVM)
    session.add(event)
    await session.commit()
    assert event.title == eventVM.title
    assert event.creator.email == user.email
    assert event.organizer.email == organizer.email

    # 2) Get Event
    event = await eventRepo.getEvent(user, userCalendar, event.id)
    assert event.title == eventVM.title
    assert event.calendar.id == userCalendar.id

    eventVM = EventBaseVM.from_orm(event)
    eventVM.organizer = EventParticipantVM(email='new-email@chrono.so')
    eventVM.description = "new description"

    # 3) Update Event
    event = await eventRepo.updateEvent(user, userCalendar, event.id, eventVM)
    await session.commit()
    assert event.organizer.email == eventVM.organizer.email
    assert event.description == eventVM.description


@pytest.mark.asyncio
async def test_event_repo_edit_permissions(user, session):
    """Tests that we can't edit an event if we don't have permission."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Creates an event. The user is not the organizer.
    # That means the event is duplicated on this calendar and not editable.
    event = createEvent(
        userCalendar, datetime.now(), datetime.now() + timedelta(hours=1), title='Event'
    )
    event.organizer = EventOrganizer('other@chrono.so', None, None)
    await session.commit()

    eventRepo = EventRepository(session)
    eventVM = await eventRepo.getEventVM(user, userCalendar, event.id)

    # Try to update the event. Should fail if modifying main event fields.
    eventVMUpdated = eventVM.copy(update={'title': "new summary"})
    with pytest.raises(EventRepoPermissionError):
        await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)

    eventVMUpdated = eventVM.copy(update={'description': "new description"})
    with pytest.raises(EventRepoPermissionError):
        await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)

    eventVMUpdated = eventVM.copy(update={'start': eventVM.start + timedelta(hours=1)})
    with pytest.raises(EventRepoPermissionError):
        await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)

    eventVMUpdated = eventVM.copy(update={'end': eventVM.end + timedelta(hours=1)})
    with pytest.raises(EventRepoPermissionError):
        await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)


@pytest.mark.asyncio
async def test_event_repo_edit_attendee_permissions_as_guest(user, session):
    """Tests edit event attendees when the user is not the organizer."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
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
    await session.commit()

    eventRepo = EventRepository(session)
    eventVM = await eventRepo.getEventVM(user, userCalendar, event.id)

    # Make sure this user can update their own responseStatus.
    newParticipants = [
        p.copy(update={'response_status': 'accepted'}) if p.email == user.email else p
        for p in eventVM.participants
    ]
    eventVMUpdated = eventVM.copy(update={'participants': newParticipants})
    event = await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)
    participant = next(p for p in event.participants if p.email == user.email)
    assert participant.response_status == 'accepted'

    # Make sure this user doesn't have the permissions to update the guest list.
    newParticipants = [p.copy(update={'response_status': 'accepted'}) for p in eventVM.participants]
    eventVMUpdated = eventVM.copy(update={'participants': newParticipants})
    event = await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)
    participantsMap = {p.email: p for p in event.participants}

    assert participantsMap['p1@chrono.so'].response_status == 'needsAction'
    assert participantsMap['p2@chrono.so'].response_status == 'needsAction'
    assert participantsMap[user.email].response_status == 'accepted'

    # Make sure we can't add a new participant.
    newParticipants.append(EventParticipantVM(email='p3@chrono.so'))
    with pytest.raises(EventRepoPermissionError):
        await eventRepo.updateEvent(
            user, userCalendar, event.id, eventVM.copy(update={'participants': newParticipants})
        )

    # Make sure we can add a new participant if guests_can_invite_others is True.
    event.guests_can_invite_others = True
    session.add(event)
    await session.commit()

    eventVM = await eventRepo.getEventVM(user, userCalendar, event.id)
    event = await eventRepo.updateEvent(
        user, userCalendar, event.id, eventVM.copy(update={'participants': newParticipants})
    )
    assert len(event.participants) == 4
    participantsMap = {p.email: p for p in event.participants}
    assert participantsMap['p3@chrono.so'].response_status == 'needsAction'

    # Cannot remove participants
    del participantsMap['p1@chrono.so']
    removedParticipants = [p for p in participantsMap.values()]
    event = await eventRepo.updateEvent(
        user, userCalendar, event.id, eventVM.copy(update={'participants': removedParticipants})
    )
    assert len(event.participants) == 4


@pytest.mark.asyncio
async def test_event_repo_edit_attendee_permissions_as_organizer(user, session):
    """Tests edit event attendees when the user is the organizer."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    event = createEvent(
        userCalendar, datetime.now(), datetime.now() + timedelta(hours=1), title='Event'
    )
    event.participants = [
        EventAttendee('p1@chrono.so', None, None, 'needsAction'),
        EventAttendee('p2@chrono.so', None, None, 'needsAction'),
        EventAttendee(user.email, None, None, 'needsAction'),
    ]
    event.organizer = EventOrganizer(user.email, None, None)
    await session.commit()

    eventRepo = EventRepository(session)
    eventVM = await eventRepo.getEventVM(user, userCalendar, event.id)

    # We can add a new participant
    newParticipants = eventVM.participants
    newParticipants.append(EventParticipantVM(email='p3@chrono.so', response_status='tentative'))
    eventVMUpdated = eventVM.copy(update={'participants': newParticipants})

    event = await eventRepo.updateEvent(user, userCalendar, event.id, eventVMUpdated)
    participantsMap = {p.email: p for p in event.participants}
    assert len(event.participants) == 4
    assert participantsMap['p3@chrono.so'].response_status == 'tentative'

    # We can remove participants
    del participantsMap['p1@chrono.so']
    del participantsMap['p2@chrono.so']

    removedParticipants = [p for p in participantsMap.values()]
    event = await eventRepo.updateEvent(
        user, userCalendar, event.id, eventVM.copy(update={'participants': removedParticipants})
    )
    assert len(event.participants) == 2
    participantsMap = {p.email: p for p in event.participants}
    assert 'p1@chrono.so' not in participantsMap
    assert 'p2@chrono.so' not in participantsMap


@pytest.mark.asyncio
async def test_event_repo_delete(user, session):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    e1 = createEvent(userCalendar, start, end, title='Blueberry Pear')
    await session.commit()

    eventRepo = EventRepository(session)

    event = await eventRepo.getEvent(user, userCalendar, e1.id)
    assert event.status == 'active'

    await eventRepo.deleteEvent(user, userCalendar, e1.id)

    event = await eventRepo.getEvent(user, userCalendar, e1.id)
    assert event.status == 'deleted'


"""Tests for Recurring Events"""


@pytest.mark.asyncio
async def test_event_repo_deleteRecurring(user: User, session: AsyncSession):
    userCalendar: UserCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    await session.commit()

    eventRepo = EventRepository(session)

    # 1) Delete Event Normally
    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-02T12:00:00'), False
    )
    event = await eventRepo.getEventVM(user, userCalendar, eventId)

    await eventRepo.deleteEvent(user, userCalendar, event.id)
    await session.commit()

    # 2) Delete Event Twice
    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-03T12:00:00'), False
    )
    event = await eventRepo.getEventVM(user, userCalendar, eventId)
    await eventRepo.deleteEvent(user, userCalendar, event.id)
    await eventRepo.deleteEvent(user, userCalendar, event.id)
    await session.commit()
    event = await eventRepo.getEvent(user, userCalendar, recurringEvent.id)

    # 3) Override then delete event
    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-04T12:00:00'), False
    )
    event = await eventRepo.getEventVM(user, userCalendar, eventId)
    event.title = 'override'
    await eventRepo.updateEvent(user, userCalendar, event.id, event)
    await eventRepo.deleteEvent(user, userCalendar, event.id)
    await session.commit()


@pytest.mark.asyncio
async def test_event_repo_getRecurringEventWithParent(user, session):
    """Make sure we can fetch an instance of a recurring event and its parent."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    await session.commit()

    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-02T12:00:00'), False
    )
    eventRepo = EventRepository(session)
    event, parent = await eventRepo.getRecurringEventWithParent(userCalendar, eventId, session)

    assert event.recurring_event_id == parent.id
    assert parent.id == recurringEvent.id


@pytest.mark.asyncio
async def test_event_repo_getRecurringEvent(user, session):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    await session.commit()

    # Assert that getRecurringEvent raises exceptions if the ID is invalid.
    validEventId = f'{recurringEvent.id}_20201202T120000Z'
    invalidEventId1 = f'{recurringEvent.id}_1212'
    invalidEventId2 = f'{recurringEvent.id}_20211202T120000Z'

    # Re-query to merge with labels joined.
    recurringEvent = (
        await session.execute(select(Event).where(Event.id == recurringEvent.id))
    ).scalar()

    getRecurringEvent(userCalendar, validEventId, recurringEvent)

    with pytest.raises(InputError):
        getRecurringEvent(userCalendar, invalidEventId1, recurringEvent)

    with pytest.raises(InputError):
        getRecurringEvent(userCalendar, invalidEventId2, recurringEvent)


@pytest.mark.asyncio
async def test_event_repo_getAllExpandedRecurringEvents_override(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event. 01-02 to 01-07 => 6 events
    start = datetime.fromisoformat('2020-01-02T12:00:00')
    baseEvent = createEvent(
        calendar,
        start,
        start + timedelta(hours=1),
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20200107T120000Z'],
    )

    # Expanded recurring events between 2 dates.
    events = await getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    assert len(events) == 2
    assert events[0].original_start == events[0].start

    # Expand all events.
    events = await getAllExpandedRecurringEventsList(
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
    await session.commit()

    events = await getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )

    assert events[0].title == baseEvent.title
    assert events[1].title == 'Override'


@pytest.mark.asyncio
async def test_event_repo_getAllExpandedRecurringEvents_fullDay(user, session):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

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
        timezone=timezone,
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
    )

    start = datetime.strptime(startDay, "%Y-%m-%d")
    createOrUpdateEvent(userCalendar, None, eventVM)
    await session.commit()

    recurringEvents = await getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=100), session
    )

    firstStart = datetime.strptime('2020-12-27', "%Y-%m-%d")
    for idx, e in enumerate(recurringEvents):
        expectedStart = firstStart + timedelta(days=7 * idx)
        assert e.start_day == expectedStart.strftime('%Y-%m-%d')
        expectedEnd = expectedStart + timedelta(days=1)
        assert e.end_day == expectedEnd.strftime('%Y-%m-%d')


@pytest.mark.asyncio
async def test_event_repo_getAllExpandedRecurringEvents_withTimezone(user, session):
    # TODO: Test expansions with timezone info in EXDate
    recurrences = [
        'EXDATE;TZID=America/Toronto:20201019T213000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
    ]


@pytest.mark.asyncio
async def test_event_repo_updateEvent_recurring(user, session):
    """Move recurring event to outside a range."""
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event. 01-02 to 01-07 => 6 events
    start = datetime.fromisoformat('2020-01-02T12:00:00')
    createEvent(
        calendar,
        start,
        start + timedelta(hours=1),
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20200107T120000Z'],
    )

    # Override the recurring event
    events = await getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    eventRepo = EventRepository(session)
    overrideEvent = events[1]
    overrideEvent.title = 'Override'

    event = await eventRepo.updateEvent(user, calendar, overrideEvent.id, overrideEvent)
    assert event.title == overrideEvent.title

    overrideEvent.title = 'Override 2'
    event = await eventRepo.updateEvent(user, calendar, overrideEvent.id, overrideEvent)
    assert event.title == overrideEvent.title


"""Test Move Events"""


@pytest.mark.asyncio
async def test_event_repo_moveEvent(user, session):
    """Moved the event from one calendar to another and make sure
    we've updated the association table.
    """
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new calendar
    userCalendar2 = createCalendar(user, 'calendar-id-2')

    # Create an event in the first calendar.
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)
    event = createEvent(userCalendar, start, end, title='Do stuff')
    session.add(event)
    await session.commit()

    eventId = event.id

    # Move the event to second calendar.
    eventRepo = EventRepository(session)

    event = await eventRepo.getEvent(user, userCalendar, eventId)
    assert event is not None

    await eventRepo.moveEvent(user, eventId, userCalendar.id, userCalendar2.id)

    # Ensure it exists in the new calendar
    event = await eventRepo.getEvent(user, userCalendar, eventId)
    assert event is None

    event = await eventRepo.getEvent(user, userCalendar2, eventId)
    assert event.id == eventId


@pytest.mark.asyncio
async def test_event_repo_moveEvent_recurring(user, session):
    """Moved the event from one calendar to another.
    Makes sure all the recurring events instances are expanded.
    """
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new calendar
    userCalendar2 = createCalendar(user, 'calendar-id-2')

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
    await session.commit()
    baseEventId = event.id

    # Make sure we can't move an instance of a recurring event.
    events = await getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=1), session
    )
    eventInstanceId = events[0].id
    eventRepo = EventRepository(session)

    with pytest.raises(EventRepoError):
        await eventRepo.moveEvent(user, eventInstanceId, userCalendar.id, userCalendar2.id)

    # Move the base event to second calendar.
    await eventRepo.moveEvent(user, baseEventId, userCalendar.id, userCalendar2.id)

    with pytest.raises(EventNotFoundError):
        event = await eventRepo.getEventVM(user, userCalendar, eventInstanceId)

    event = await eventRepo.getEventVM(user, userCalendar2, eventInstanceId)
    assert event.id == eventInstanceId


@pytest.mark.asyncio
async def test_event_repo_eventMatchesQuery(user, session):
    """TODO: Test that the OR filters match results given from a full text Postgres search."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
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
