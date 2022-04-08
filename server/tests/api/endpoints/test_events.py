import pytest
import json
from uuid import uuid4
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.repos.event_repo import (
    EventRepository,
    getExpandedRecurringEvents,
    getAllExpandedRecurringEventsList,
)
from app.api.repos.event_utils import (
    EventParticipantVM,
    createOrUpdateEvent,
)
from app.api.endpoints.authentication import getAuthToken
from app.db.models.event_participant import EventParticipant

from tests.utils import createEvent
from app.db.models import User, Event, Contact
from app.db.models.event import EventCalendar, stripParticipants


@pytest.mark.asyncio
async def test_stripParticipants():
    title = """eat with @[jony]([id:abcabc123][type:Contact])"""

    assert stripParticipants(title) == 'eat with jony'


@pytest.mark.asyncio
async def test_getEventsBasic(user: User, session, async_client):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(userCalendar, start, start + timedelta(hours=1))
    session.add(event1)

    start2 = start + timedelta(days=1)
    event2 = createEvent(userCalendar, start2, start2 + timedelta(minutes=30))
    session.add(event2)

    token = getAuthToken(user)
    startFilter = (start - timedelta(days=1)).isoformat()
    resp = await async_client.get(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': token},
        params={'start_date': startFilter},
    )

    events = resp.json()
    assert len(events) == 2
    assert events[0].get('id') == event1.id
    assert events[1].get('id') == event2.id


@pytest.mark.asyncio
async def test_createEvent_single(user: User, session, async_client):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat("2021-01-11T09:30:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": userCalendar.id,
    }

    resp = await async_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')

    result = await session.execute(user.getSingleEventsStmt())
    userEvents = result.scalars().all()

    assert len(userEvents) == 1

    eventDb = userEvents[0]
    assert eventDb.title == event.get('title')
    assert eventDb.start == start
    assert eventDb.end == end
    assert not eventDb.all_day


@pytest.mark.asyncio
async def test_createEvent_recurring_invalid(user: User, session, async_client):
    """Malformed recurrence string."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)
    event = {
        "title": "laundry",
        "start": '20210111T050000Z',  # start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": userCalendar.id,
    }

    rule = """
        DTSTART:20210111T050000Z
        RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5
    """
    event['recurrences'] = [r.strip() for r in rule.split('\n') if r.strip()]
    resp = await async_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    assert resp.status_code == 422

    event['recurrences'] = ['RRULE:FREQ=DAILY;INTERVAL=1;COUNT=invalid']
    resp = await async_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_createEvent_recurring(user: User, session, async_client, eventRepo: EventRepository):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    rule = """RRULE:FREQ=DAILY;INTERVAL=1;COUNT=3"""
    recurrences = [r.strip() for r in rule.split('\n') if r.strip()]

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": calendar.id,
        "recurrences": recurrences,
    }

    resp = await async_client.post(
        f'/api/v1/calendars/{calendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    assert resp.status_code == 200

    eventId = resp.json()['id']
    eventDb = await eventRepo.getEvent(user, calendar, eventId)

    assert eventDb.recurrences == recurrences

    events = list(
        getExpandedRecurringEvents(user, calendar, eventDb, {}, start, start + timedelta(days=5))
    )
    assert len(events) == 3


@pytest.mark.asyncio
async def test_createEvent_allDay(user: User, session, async_client, eventRepo: EventRepository):
    """TODO: API Should only need one of start / end and start_day / end_day"""
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat("2021-01-11T00:00:00+00:00")
    end = start + timedelta(days=1)

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "start_day": start.strftime('%Y-%m-%d'),
        "end_day": end.strftime('%Y-%m-%d'),
        "calendar_id": calendar.id,
    }

    resp = await async_client.post(
        f'/api/v1/calendars/{calendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')
    assert eventResp.get('all_day') == True

    eventId = resp.json()['id']
    eventDb = await eventRepo.getEvent(user, calendar, eventId)
    assert eventDb


@pytest.mark.asyncio
async def test_createEvent_withLabels(user: User, session, async_client):
    """Create event with label"""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    from app.api.endpoints.labels import createOrUpdateLabel, LabelVM, LabelInDbVM

    # Create a label in DB
    labelVM = LabelVM(title='label-1', color_hex='#ffffff')
    label = await createOrUpdateLabel(user, None, labelVM, session)
    await session.commit()
    labelInDB = LabelInDbVM.from_orm(label)

    # Create an event with the existing label
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        'title': 'laundry',
        'start': start.isoformat(),
        'end': end.isoformat(),
        'calendar_id': userCalendar.id,
        'labels': [labelInDB.dict()],
    }

    resp = await async_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    
    # Make sure the label is attached.
    assert resp.status_code == 200

    labels = resp.json()['labels']
    assert len(labels) == 1
    assert labels[0]['id'] == labelInDB.id


@pytest.mark.asyncio
async def test_createEvent_withLabels_nonExisting(user: User, session, async_client):
    """Create event with label"""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create an event with a non existing label
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        'title': 'laundry',
        'start': start.isoformat(),
        'end': end.isoformat(),
        'calendar_id': userCalendar.id,
        'labels': [{'id': 123, 'title': 'chore', 'color_hex': '#ffffff'}],
    }

    resp = await async_client.post(
        f'/api/v1/calendars/{userCalendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_createEvent_withParticipants(user: User, session, async_client):
    """Create event with participants emails.
    If the user has the contact stored, make sure that it's linked to the participant.
    """

    # Setup Existing Contact
    contact = Contact('Jon', 'Snow', 'jon@example.com', 'test-img.png', None)
    user.contacts.append(contact)
    await session.commit()

    # Create new event with participants

    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat("2021-01-11T00:00:00+00:00")
    end = start + timedelta(days=1)
    event = {
        "title": "meeting",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "start_day": start.strftime('%Y-%m-%d'),
        "end_day": end.strftime('%Y-%m-%d'),
        "calendar_id": calendar.id,
        "participants": [
            {'contact_id': contact.id},
            {'email': 'adam@example.com'},
        ],
    }

    resp = await async_client.post(
        f'/api/v1/calendars/{calendar.id}/events/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(event),
    )

    assert len(resp.json().get('participants')) == 2

    eventId = resp.json().get('id')
    eventDb = (await session.execute(select(Event).where(Event.id == eventId))).scalar()
    for participant in eventDb.participants:
        if participant.email == contact.email:
            assert participant.contact_id == contact.id

    # Make sure the event has the added participants

    eventJson = (
        await async_client.get(
            f'/api/v1/calendars/{calendar.id}/events/{eventId}',
            headers={'Authorization': getAuthToken(user)},
        )
    ).json()
    participants = eventJson['participants']

    assert len(participants) == 2
    assert participants[0]['email'] == contact.email
    assert participants[0]['photo_url'] == 'test-img.png'


@pytest.mark.asyncio
async def test_updateEvent_withParticipants(user: User, session, async_client):
    # Setup Existing Contact
    contact = Contact('Jon', 'Snow', 'jon@example.com', 'test-img.png', None)
    user.contacts.append(contact)

    # Create an event with participants.
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(calendar, start, start + timedelta(hours=1))
    session.add(event1)

    await session.commit()

    participant = EventParticipant(contact.email, contact.id)
    participant.event_id = event1.id
    session.add(participant)

    await session.commit()

    # Update: add a participant and remove another.
    eventJson = (
        await async_client.get(
            f'/api/v1/calendars/{calendar.id}/events/{event1.id}',
            headers={'Authorization': getAuthToken(user)},
        )
    ).json()

    eventJson['participants'] = [
        {'email': 'new@example.com', 'photoUrl': 'xyz.png'},
    ]

    _ = await async_client.put(
        f'/api/v1/calendars/{calendar.id}/events/{event1.id}',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(eventJson),
    )

    # Make sure the event is updated in the DB.

    event = (
        await session.execute(
            select(Event).where(Event.id == event1.id).options(selectinload(Event.participants))
        )
    ).scalar()

    assert len(event.participants) == 1
    assert event.participants[0].email == 'new@example.com'


@pytest.mark.asyncio
async def test_updateEvent_recurring(user: User, session, async_client):
    """Modify for this & following events.
    TODO: Should delete outdated, overriden events.
    """
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event 2020-01-01 to 2020-01-10 => 10 events.
    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200110T120000Z']

    events = await getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=20), session
    )
    assert len(events) == 10

    # Create an overidden event

    override = createOrUpdateEvent(None, events[8])
    override.title = 'Override'
    override.id = events[8].id

    await session.commit()

    # Trim the original event's instance list
    # Now, it starts from 2020-01-05.

    eventData = {
        "title": recurringEvent.title,
        "start": recurringEvent.start.isoformat(),
        "end": recurringEvent.end.isoformat(),
        "calendar_id": userCalendar.id,
        "recurrences": ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z'],
    }
    resp = await async_client.put(
        f'/api/v1/calendars/{userCalendar.id}/events/{recurringEvent.id}',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(eventData),
    )

    assert resp.status_code == 200

    events = await getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=20), session
    )

    # The overriden event should be removed.
    assert len(events) == 5


@pytest.mark.asyncio
async def test_deleteEvent_single(user, session, async_client):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.now()
    end = start + timedelta(hours=1)
    event = createEvent(calendar, start, end)
    session.add(event)

    await session.commit()

    result = await session.execute(user.getSingleEventsStmt())
    events = result.scalars().all()

    assert len(events) == 1

    resp = await async_client.delete(
        f'/api/v1/calendars/{calendar.id}/events/{event.id}',
        headers={'Authorization': getAuthToken(user)},
    )

    assert resp.status_code == 200
    result = await session.execute(user.getSingleEventsStmt())
    events = result.scalars().all()
    assert len(events) == 0


@pytest.mark.asyncio
async def test_deleteEvent_overrides(user: User, session, async_client):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z']

    events = await getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=5), session
    )
    override = createOrUpdateEvent(None, events[2])
    override.title = 'Override'
    override.id = events[2].id

    ec = EventCalendar()
    ec.event = override
    userCalendar.calendar.events.append(ec)

    await session.commit()

    resp = await async_client.delete(
        f'/api/v1/calendars/{userCalendar.id}/events/{recurringEvent.id}',
        headers={'Authorization': getAuthToken(user)},
    )

    result = await session.execute(
        select(Event)
        .where(Event.user_id == user.id)
        .options(selectinload(Event.labels))
        .options(selectinload(Event.participants))
    )
    events = result.scalars().all()

    assert resp.status_code == 200
    assert len(events) == 1
    assert events[0].status == 'deleted'
