import uuid
import shortuuid
import json

from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from tests.utils import createCalendar, createEvent

from app.api.endpoints.authentication.token_utils import getAuthToken

from app.db.repos.event_repo import (
    EventRepository,
    getExpandedRecurringEvents,
    getAllExpandedRecurringEventsList,
)
from app.db.repos.event_utils import (
    createOrUpdateEvent,
)
from app.db.repos.calendar_repo import CalendarRepository

from app.db.models import User, Event, Contact
from app.db.models.event import stripParticipants
from app.db.models.event_participant import EventAttendee


def test_stripParticipants():
    title = """eat with @[jony]([id:abcabc123][type:Contact])"""

    assert stripParticipants(title) == 'eat with jony'


def test_getEventsBasic(user: User, session, test_client):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(userCalendar, start, start + timedelta(hours=1))
    session.add(event1)

    start2 = start + timedelta(days=1)
    event2 = createEvent(userCalendar, start2, start2 + timedelta(minutes=30))
    session.add(event2)

    token = getAuthToken(user)
    startFilter = (start - timedelta(days=1)).isoformat()
    resp = test_client.get(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': token},
        params={'start_date': startFilter},
    )

    events = resp.json()
    assert len(events) == 2
    assert events[0].get('id') == event1.id
    assert events[1].get('id') == event2.id


def test_createEvent_single(user: User, session, test_client):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    start = datetime.fromisoformat("2021-01-11T09:30:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": str(userCalendar.id),
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')

    eventRepo = EventRepository(session)
    userEvents = eventRepo.getSingleEvents(user, userCalendar.id)

    assert len(userEvents) == 1

    eventDb = userEvents[0]
    assert eventDb.title == event.get('title')
    assert eventDb.start == start
    assert eventDb.end == end
    assert not eventDb.all_day


def test_createEvent_withId(user: User, session, test_client):
    """Makes sure the event is created with the given id."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)
    event = {
        'id': shortuuid.uuid(),
        "title": "workout",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": str(userCalendar.id),
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    eventResp = resp.json()

    assert eventResp['id'] == event['id']


def test_createEvent_withId_invalid(user: User, session, test_client):
    """Makes sure the event is created with the given id."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)
    event = {
        'id': f'{shortuuid.uuid()}-bad',
        "title": "workout",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": str(userCalendar.id),
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )

    assert not resp.ok


def test_createEvent_recurring_invalid(user: User, session, test_client):
    """Malformed recurrence string."""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)
    event = {
        "title": "laundry",
        "start": '20210111T050000Z',  # start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": str(userCalendar.id),
    }

    rule = """
        DTSTART:20210111T050000Z
        RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5
    """
    event['recurrences'] = [r.strip() for r in rule.split('\n') if r.strip()]
    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    assert resp.status_code == 422

    event['recurrences'] = ['RRULE:FREQ=DAILY;INTERVAL=1;COUNT=invalid']
    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    assert resp.status_code == 422


def test_createEvent_recurring(user: User, session, test_client, eventRepo: EventRepository):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    rule = """RRULE:FREQ=DAILY;INTERVAL=1;COUNT=3"""
    recurrences = [r.strip() for r in rule.split('\n') if r.strip()]

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": str(userCalendar.id),
        "recurrences": recurrences,
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    assert resp.status_code == 200

    eventId = resp.json()['id']
    eventDb = eventRepo.getEvent(user, userCalendar, eventId)
    assert eventDb is not None

    assert eventDb.recurrences == recurrences

    events = list(getExpandedRecurringEvents(user, eventDb, {}, start, start + timedelta(days=5)))
    assert len(events) == 3


def test_createEvent_allDay(user: User, session, test_client, eventRepo: EventRepository):
    """TODO: API Should only need one of start / end and start_day / end_day"""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    start = datetime.fromisoformat("2021-01-11T00:00:00+00:00")
    end = start + timedelta(days=1)

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "start_day": start.strftime('%Y-%m-%d'),
        "end_day": end.strftime('%Y-%m-%d'),
        "calendar_id": str(userCalendar.id),
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')
    assert eventResp.get('all_day') == True

    eventId = resp.json()['id']
    eventDb = eventRepo.getEvent(user, userCalendar, eventId)
    assert eventDb


def test_createEvent_withLabels(user: User, session, test_client):
    """Create event with label"""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    from app.api.endpoints.labels import createOrUpdateLabel, LabelVM, LabelInDbVM

    # Create a label in DB
    labelVM = LabelVM(title='label-1', color_hex='#ffffff')
    label = createOrUpdateLabel(user, None, labelVM, session)
    session.commit()
    labelInDB = LabelInDbVM.from_orm(label)

    # Create an event with the existing label
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        'title': 'laundry',
        'start': start.isoformat(),
        'end': end.isoformat(),
        'calendar_id': str(userCalendar.id),
        'labels': [json.loads(labelInDB.json())],
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )

    # Make sure the label is attached.
    assert resp.status_code == 200

    labels = resp.json()['labels']
    assert len(labels) == 1
    assert labels[0]['id'] == str(labelInDB.id)


def test_createEvent_withLabels_nonExisting(user: User, session, test_client):
    """Create event with label"""
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create an event with a non existing label
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        'title': 'laundry',
        'start': start.isoformat(),
        'end': end.isoformat(),
        'calendar_id': str(userCalendar.id),
        'labels': [{'id': str(uuid.uuid4()), 'title': 'chore', 'color_hex': '#ffffff'}],
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )
    assert resp.status_code == 400


def test_createEvent_withParticipants(user: User, session, test_client):
    """Create event with participants emails.
    If the user has the contact stored, make sure that it's linked to the participant.
    """

    # Setup Existing Contact

    contact = Contact('Jon', 'Snow', 'jon@example.com', 'test-img.png', None)
    user.contacts.append(contact)
    session.commit()

    # Create new event with two participants

    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat("2021-01-11T00:00:00+00:00")
    end = start + timedelta(days=1)
    event = {
        "title": "meeting",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "start_day": start.strftime('%Y-%m-%d'),
        "end_day": end.strftime('%Y-%m-%d'),
        "calendar_id": str(userCalendar.id),
        "participants": [
            {'contact_id': str(contact.id)},
            {'email': 'adam@example.com'},
        ],
    }

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        json=event,
    )

    assert len(resp.json().get('participants')) == 2

    eventId = resp.json().get('id')
    eventDb = (session.execute(select(Event).where(Event.id == eventId))).scalar()
    for participant in eventDb.participants:
        if participant.email == contact.email:
            assert participant.contact_id == contact.id

    # Make sure the event has the added participants

    eventJson = (
        test_client.get(
            f'/api/v1/calendars/{userCalendar.id}/events/{eventId}',
            headers={'Authorization': getAuthToken(user)},
        )
    ).json()
    participants = eventJson['participants']

    assert len(participants) == 2

    p1 = next(p for p in participants if p['email'] == contact.email)
    assert p1['photo_url'] == contact.photo_url
    assert p1['contact_id'] == str(contact.id)

    p2 = next(p for p in participants if p['email'] == 'adam@example.com')
    assert p2


def test_updateEvent_withParticipants(user: User, session, test_client):
    # Setup Existing Contact
    contact = Contact('Jon', 'Snow', 'jon@example.com', 'test-img.png', None)
    user.contacts.append(contact)

    # Create an event with participants.
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(userCalendar, start, start + timedelta(hours=1))
    session.add(event1)

    session.commit()

    participant = EventAttendee(contact.email, None, contact.id, 'needsAction')
    participant.event_id = event1.id
    session.add(participant)

    session.commit()

    # Update: add a participant and remove another.
    eventJson = (
        test_client.get(
            f'/api/v1/calendars/{userCalendar.id}/events/{event1.id}',
            headers={'Authorization': getAuthToken(user)},
        )
    ).json()

    eventJson['participants'] = [
        {'email': 'new@example.com', 'photoUrl': 'xyz.png'},
    ]

    _ = test_client.put(
        f'/api/v1/calendars/{userCalendar.id}/events/{event1.id}',
        headers={'Authorization': getAuthToken(user)},
        json=eventJson,
    )

    # Make sure the event is updated in the DB.

    event = (
        session.execute(
            select(Event).where(Event.id == event1.id).options(selectinload(Event.participants))
        )
    ).scalar()

    assert len(event.participants) == 1
    assert event.participants[0].email == 'new@example.com'


def test_updateEvent_recurring(user: User, session, test_client):
    """Modify for this & following events.
    TODO: Should delete outdated, overriden events.
    """
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    # Create a new recurring event 2020-01-01 to 2020-01-10 => 10 events.
    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200110T120000Z']

    events = getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=20), session
    )
    assert len(events) == 10

    # Create an overidden event

    override = createOrUpdateEvent(userCalendar, None, events[8])
    override.title = 'Override'
    override.id = events[8].id

    session.commit()

    # Trim the original event's instance list
    # Now, it starts from 2020-01-05.

    eventData = {
        "title": recurringEvent.title,
        "start": recurringEvent.start.isoformat(),
        "end": recurringEvent.end.isoformat(),
        "calendar_id": str(userCalendar.id),
        "recurrences": ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z'],
    }
    resp = test_client.put(
        f'/api/v1/calendars/{userCalendar.id}/events/{recurringEvent.id}',
        headers={'Authorization': getAuthToken(user)},
        json=eventData,
    )

    assert resp.status_code == 200

    events = getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=20), session
    )

    # The overriden event should be removed.
    assert len(events) == 5


def test_moveEvent_single(user, session, test_client):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)
    start = datetime.now()
    end = start + timedelta(hours=1)
    event = createEvent(userCalendar, start, end)
    session.add(event)
    session.commit()

    # Move in same calendar returns error message.
    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/{event.id}/move',
        headers={'Authorization': getAuthToken(user)},
        json={'calendar_id': str(userCalendar.id)},
    )
    assert resp.status_code == 400

    # Move to different calendar
    cal2 = createCalendar(user, uuid.uuid4())

    resp = test_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/{event.id}/move',
        headers={'Authorization': getAuthToken(user)},
        json={'calendar_id': str(cal2.id)},
    )

    # Make sure it's not in the old calendar
    resp = test_client.get(
        f'/api/v1/calendars/{userCalendar.id}/events/{event.id}',
        headers={'Authorization': getAuthToken(user)},
    )
    assert resp.status_code == 404

    # Make sure we can fetch from the new calendar
    resp = test_client.get(
        f'/api/v1/calendars/{cal2.id}/events/{event.id}',
        headers={'Authorization': getAuthToken(user)},
    )
    assert resp.json().get('id') == event.id


def test_deleteEvent_single(user, session, test_client):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    start = datetime.now()
    end = start + timedelta(hours=1)
    event = createEvent(userCalendar, start, end)
    session.add(event)
    session.commit()

    eventRepo = EventRepository(session)
    events = eventRepo.getSingleEvents(user, userCalendar.id)

    assert len(events) == 1

    resp = test_client.delete(
        f'/api/v1/calendars/{userCalendar.id}/events/{event.id}',
        headers={'Authorization': getAuthToken(user)},
    )

    assert resp.status_code == 200

    events = eventRepo.getSingleEvents(user, userCalendar.id)

    assert len(events) == 0


def test_deleteEvent_overrides(user: User, session, test_client):
    userCalendar = CalendarRepository(session).getPrimaryCalendar(user.id)

    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z']

    events = getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=5), session
    )
    override = createOrUpdateEvent(userCalendar, None, events[2])
    override.title = 'Override'
    override.id = events[2].id
    override.calendar_id = userCalendar.id

    session.commit()

    resp = test_client.delete(
        f'/api/v1/calendars/{userCalendar.id}/events/{recurringEvent.id}',
        headers={'Authorization': getAuthToken(user)},
    )

    result = session.execute(
        select(Event).options(selectinload(Event.labels)).options(selectinload(Event.participants))
    )
    events = result.scalars().unique().all()

    assert resp.status_code == 200
    assert len(events) == 1
    assert events[0].status == 'deleted'
