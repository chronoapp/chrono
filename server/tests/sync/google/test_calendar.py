import uuid
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.db.models import User, Event, Calendar, UserCalendar
from app.db.models.conference_data import CommunicationMethod, ConferenceKeyType

from app.sync.google.calendar import (
    syncEventsToDb,
    syncCreatedOrUpdatedGoogleEvent,
)
from app.db.repos.event_utils import getRecurringEventId
from app.db.repos.event_repo import EventRepository
from app.db.repos.calendar_repo import CalendarRepository
from app.db.repos.contact_repo import ContactRepository, ContactVM

EVENT_ITEM_RECURRING = {
    'kind': 'calendar#event',
    'etag': '"3214969133292000"',
    'id': '02kan06ornak4vngjaeem1rjhl',
    'status': 'confirmed',
    'created': '2020-12-09T03:29:26.000Z',
    'updated': '2020-12-09T03:29:26.646Z',
    'summary': 'Test Recur',
    'creator': {'email': 'test-email@example.com', 'self': True},
    'organizer': {'email': 'test-email@example.com', 'self': True},
    'start': {'dateTime': '2020-12-09T11:00:00-05:00', 'timeZone': 'America/Toronto'},
    'end': {'dateTime': '2020-12-09T12:00:00-05:00', 'timeZone': 'America/Toronto'},
    'recurrence': ['RRULE:FREQ=DAILY;COUNT=5'],
    'sequence': 0,
    'reminders': {'useDefault': True},
}


def getRecurringEventItem(eventItem, datetime: datetime):
    """Creates an overidden instance of a recurring event."""
    eventItem = eventItem.copy()
    originalId = eventItem['id']

    eventItem['id'] = getRecurringEventId(originalId, datetime, False)
    eventItem['summary'] = eventItem['summary'] + ' - override'
    eventItem['recurringEventId'] = originalId
    eventItem['originalStartTime'] = {
        'dateTime': datetime.isoformat(),
        'timeZone': 'America/Toronto',
    }
    eventItem['attendees'] = [
        {'email': 'test1@example.com', 'responseStatus': 'needsAction'},
        {'email': 'test2@example.com', 'responseStatus': 'needsAction'},
    ]
    del eventItem['recurrence']

    return eventItem


def test_syncCreatedOrUpdatedGoogleEvent_single(user, session: Session, eventRepo: EventRepository):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    event = syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)
    session.commit()

    assert event.title == eventItem.get('summary')
    assert event.google_id == eventItem.get('id')
    assert event.creator and event.creator.email == 'test-email@example.com'

    events = eventRepo.getSingleEvents(user, calendar.id)
    assert len(events) == 1


def test_syncCreatedOrUpdatedGoogleEvent_single_with_attendees(user, session, eventRepo):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Initial contact list. Make sure the contact is linked to the event attendee.
    contactRepo = ContactRepository(session)
    contact = ContactVM(email='jon@chrono.so')
    contact = contactRepo.addContact(user, contact)

    session.commit()

    # Add attendees
    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    eventItem['attendees'] = [
        {'email': 'jon@chrono.so', 'self': True, 'displayName': 'Jon'},
        {'email': 'abe@chrono.so'},
    ]

    event = syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)
    attendeeMap = {p.email: p for p in event.participants}
    session.commit()

    assert len(event.participants) == 2
    assert attendeeMap['jon@chrono.so'].contact == contact

    # Update attendees
    eventItem['attendees'] = [
        {'email': 'sally@chrono.so', 'self': True, 'displayName': 'Sally'},
        {'email': 'eric@chrono.so'},
    ]
    event = syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)
    attendeeMap = {p.email: p for p in event.participants}

    assert len(event.participants) == 2
    assert attendeeMap['sally@chrono.so'].display_name == 'Sally'


def test_syncCreatedOrUpdatedGoogleEvent_recurring(user, session, eventRepo):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    event = syncCreatedOrUpdatedGoogleEvent(
        calendar, eventRepo, None, EVENT_ITEM_RECURRING, session
    )
    session.commit()

    assert event.google_id == EVENT_ITEM_RECURRING.get('id')

    eventRepo = EventRepository(session)
    events = eventRepo.getRecurringEvents(user, calendar.id, datetime.fromisoformat('2021-01-01'))

    assert len(events) == 1
    assert events[0].recurrences != None


def test_syncCreatedOrUpdatedGoogleEvent_allDay(user, session, eventRepo):
    eventItem = {
        'id': '20201225_60o30chp64o30c1g60o30dr56g',
        'status': 'confirmed',
        'created': '2019-09-18T22:47:44.000Z',
        'updated': '2019-09-18T22:47:44.000Z',
        'summary': 'Christmas Day',
        'start': {'date': '2020-12-25'},
        'end': {'date': '2020-12-26'},
        'transparency': 'transparent',
        'visibility': 'public',
    }

    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    event = syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)

    assert event.all_day
    assert event.start_day == '2020-12-25'
    assert event.end_day == '2020-12-26'
    assert event.start == datetime.fromisoformat('2020-12-25T00:00:00')
    assert event.end == datetime.fromisoformat('2020-12-26T00:00:00')


def test_syncEventsToDb_deleted(user, session: Session):
    """TODO: Ensures that all child events are deleted when the parent
    recurring event is deleted.
    """
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    syncEventsToDb(calendar, [EVENT_ITEM_RECURRING], session)
    session.commit()

    eventRepo = EventRepository(session)
    events = eventRepo.getRecurringEvents(user, calendar.id, datetime.fromisoformat('2021-01-01'))

    assert len(events) == 1
    assert events[0].status == 'active'

    # Remove the event.
    eventItem = EVENT_ITEM_RECURRING.copy()
    eventItem['status'] = 'cancelled'

    syncEventsToDb(calendar, [eventItem], session)
    session.commit()

    events = eventRepo.getRecurringEvents(user, calendar.id, datetime.fromisoformat('2021-01-01'))
    assert len(events) == 0


# ==================== Recurring Events ====================


def test_syncEventsToDb_recurring(user, session: Session):
    """Event from 11:00-11:30pm: at 01-09, (EXCLUDE 01-10), 01-11, 01-12
    - UPDATE event's time at 01-10 -> 10-11
    - DELETE event at 01-12
    Result: [Event: 01-09, Event: 01-11 (updated)]
    """
    googleEventId = '7bpp8ujgsitkcuk6h1er0nadfn'
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    eventItems = [
        {
            "id": googleEventId,
            "status": "confirmed",
            "summary": "recurring-event",
            "start": {"dateTime": "2021-01-09T23:00:00-05:00", "timeZone": "America/Toronto"},
            "end": {"dateTime": "2021-01-09T23:30:00-05:00", "timeZone": "America/Toronto"},
            "recurrence": [
                "EXDATE;TZID=America/Toronto:20210111T230000",
                "RRULE:FREQ=DAILY;UNTIL=20210113T045959Z",
            ],
        },
        {
            "id": f"{googleEventId}_20210111T040000Z",
            "status": "confirmed",
            "summary": "recurring-event",
            "start": {"dateTime": "2021-01-11T09:15:00-05:00"},
            "end": {"dateTime": "2021-01-11T09:45:00-05:00"},
            "recurringEventId": googleEventId,
            "originalStartTime": {"dateTime": "2021-01-10T23:00:00-05:00"},
        },
        {
            "id": f"{googleEventId}_20210113T040000Z",
            "status": "cancelled",
            "recurringEventId": googleEventId,
            "originalStartTime": {"dateTime": "2021-01-12T23:00:00-05:00"},
        },
    ]

    syncEventsToDb(calendar, eventItems, session)
    session.commit()

    eventRepo = EventRepository(session)
    parent = eventRepo.getGoogleEvent(calendar, googleEventId)

    assert parent is not None

    events = eventRepo.getSingleEvents(user, calendar.id, showDeleted=True)

    assert len(events) == 3

    recurringEvents = [e for e in events if e.recurring_event_id]

    assert len(recurringEvents) == 2

    for e in recurringEvents:
        assert e.recurring_event_id == parent.id
        assert e.recurring_event_calendar_id == parent.calendar_id


def test_syncEventsToDb_recurring_withParticipants(user, session):
    """Make sure participants are created."""
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Add the parent event

    eventItemParent = EVENT_ITEM_RECURRING.copy()
    eventItemParent['id'] = 'abcabc'
    eventItemParent['attendees'] = [
        {'email': 'test1@example.com', 'responseStatus': 'needsAction'},
        {'email': 'test2@example.com', 'responseStatus': 'needsAction'},
    ]

    # Add the recurring event instance

    eventItem = getRecurringEventItem(
        eventItemParent, datetime.fromisoformat('2020-12-11T11:00:00-05:00')
    )

    syncEventsToDb(calendar, [eventItem, eventItemParent], session)
    session.commit()

    eventRepo = EventRepository(session)
    events = eventRepo.getSingleEvents(user, calendar.id)

    assert len(events) == 2

    recurringEventInstance = next(e for e in events if e.recurrences is None)

    assert recurringEventInstance.google_id == eventItem['id']
    assert len(recurringEventInstance.participants) == 2

    participantEmails = {p.email for p in recurringEventInstance.participants}

    assert 'test1@example.com' in participantEmails
    assert 'test2@example.com' in participantEmails


def test_syncEventsToDb_duplicateEventMultipleCalendars(user: User, session: Session):
    """Add the same event to multiple calendars.
    The event should be duplicated and exist in each calendar.
    """
    # Original Calendar
    myCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Add another calendar
    calendarId = uuid.uuid4()
    readOnlyCalendar = UserCalendar(
        calendarId,
        None,
        '#ffffff',
        '#000000',
        True,
        'owner',
        True,
        False,
    )
    readOnlyCalendar.calendar = Calendar(
        calendarId, 'Another calendar', 'description', 'America/Toronto', 'test@example.com'
    )
    user.calendars.append(readOnlyCalendar)

    # Create events in both calendar
    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    syncEventsToDb(readOnlyCalendar, [eventItem], session)
    syncEventsToDb(myCalendar, [eventItem], session)

    eventRepo = EventRepository(session)

    events1 = eventRepo.getSingleEvents(user, readOnlyCalendar.id)
    assert len(events1) == 1

    events2 = eventRepo.getSingleEvents(user, myCalendar.id)
    assert len(events2) == 1

    assert events1[0].google_id == events2[0].google_id


def test_syncEventsToDb_changedRecurringEvent(user: User, session: Session):
    """Sync a google event where:
    - Event id is the same, but the recurring event has changed.
    """
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    eventRepo = EventRepository(session)

    parentEvent = EVENT_ITEM_RECURRING.copy()
    recurringEvent = getRecurringEventItem(
        parentEvent, datetime.fromisoformat('2020-07-12T10:30:00-05:00')
    )

    syncEventsToDb(calendar, [parentEvent, recurringEvent], session)
    calEvents = eventRepo.getSingleEvents(user, calendar.id)

    assert len(calEvents) == 2

    # Sync the event again. The Event ID is the same, but it has been attached
    # to a different parent recurring event.

    parentEvent2 = parentEvent.copy()
    parentEvent2['id'] = 'different-id'

    recurringEvent2 = getRecurringEventItem(
        parentEvent2, datetime.fromisoformat('2020-07-12T10:30:00-05:00')
    )
    recurringEvent2['id'] = recurringEvent['id']

    syncEventsToDb(calendar, [recurringEvent2, parentEvent2], session)

    calEvents = eventRepo.getSingleEvents(user, calendar.id)
    googleEventIds = set(e.google_id for e in calEvents)

    assert recurringEvent2['id'] in googleEventIds
    assert parentEvent2['id'] in googleEventIds


# ==================== Conferencing ====================


def test_syncCreatedOrUpdatedGoogleEvent_conferenceGoogleHangout(
    user, session: Session, eventRepo: EventRepository
):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    logoIconUri = "https://fonts.gstatic.com/s/i/productlogos/logo.png"
    eventItem['conferenceData'] = {
        "createRequest": {
            "requestId": "cllb95m1t299q496ao2jbqwu3",
            "conferenceSolutionKey": {"type": "hangoutsMeet"},
            "status": {"statusCode": "success"},
        },
        "entryPoints": [
            {
                "entryPointType": "video",
                "uri": "https://meet.google.com/orw-shac-hgg",
                "label": "meet.google.com/orw-shac-hgg",
            }
        ],
        "conferenceSolution": {
            "key": {"type": "hangoutsMeet"},
            "name": "Google Meet",
            "iconUri": logoIconUri,
        },
        "conferenceId": "orw-shac-hgg",
    }

    event = syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)
    assert event.conference_data is not None
    assert event.conference_data.conference_id == 'orw-shac-hgg'
    assert event.conference_data.conference_solution.name == 'Google Meet'
    assert event.conference_data.conference_solution.key_type == ConferenceKeyType.HANGOUTS_MEET
    assert event.conference_data.conference_solution.icon_uri == logoIconUri

    assert len(event.conference_data.entry_points) == 1
    entrypoint = event.conference_data.entry_points[0]
    assert entrypoint.entry_point_type == CommunicationMethod.VIDEO
    assert entrypoint.uri == 'https://meet.google.com/orw-shac-hgg'
    assert entrypoint.label == 'meet.google.com/orw-shac-hgg'


def test_syncCreatedOrUpdatedGoogleEvent_zoom(user, session: Session, eventRepo: EventRepository):
    calendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    logoIconUri = "https://lh3.googleusercontent.com/abcabc"
    videoLabel = 'us04web.zoom.us/j/123123?pwd=txD665'
    videoUri = f'https://{videoLabel}'

    eventItem["conferenceData"] = {
        "entryPoints": [
            {
                "entryPointType": "video",
                "uri": videoUri,
                "label": videoLabel,
                "meetingCode": "123123",
                "password": "txD665",
            }
        ],
        "conferenceSolution": {
            "key": {"type": "addOn"},
            "name": "Zoom meeting",
            "iconUri": logoIconUri,
        },
        "conferenceId": "123123",
    }

    event = syncCreatedOrUpdatedGoogleEvent(calendar, eventRepo, None, eventItem, session)

    assert event.conference_data is not None
    assert event.conference_data.conference_id == '123123'
    assert event.conference_data.conference_solution.name == 'Zoom meeting'
    assert event.conference_data.conference_solution.key_type == ConferenceKeyType.ADD_ON
    assert event.conference_data.conference_solution.icon_uri == logoIconUri

    assert len(event.conference_data.entry_points) == 1
    entrypoint = event.conference_data.entry_points[0]
    assert entrypoint.entry_point_type == CommunicationMethod.VIDEO
    assert entrypoint.uri == videoUri
    assert entrypoint.label == videoLabel
    assert entrypoint.meeting_code == '123123'
    assert entrypoint.password == 'txD665'
