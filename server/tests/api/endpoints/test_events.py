import pytest
import json
from uuid import uuid4
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.api.repos.event_utils import (
    getExpandedRecurringEvents,
    getAllExpandedRecurringEventsList,
    createOrUpdateEvent,
)
from app.api.endpoints.authentication import getAuthToken
from app.db.models.event_participant import EventParticipant

from tests.utils import createEvent
from app.db.models import User, Event, Contact


@pytest.mark.asyncio
async def test_getEventsBasic(user: User, session, async_client):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(calendar, start, start + timedelta(hours=1))
    session.add(event1)

    start2 = start + timedelta(days=1)
    event2 = createEvent(calendar, start2, start2 + timedelta(minutes=30))
    session.add(event2)

    token = getAuthToken(user)
    startFilter = (start - timedelta(days=1)).isoformat()
    resp = await async_client.get(
        f'/api/v1/events/', headers={'Authorization': token}, params={'start_date': startFilter}
    )

    events = resp.json()
    assert len(events) == 2
    assert events[0].get('id') == event1.id
    assert events[1].get('id') == event2.id


@pytest.mark.asyncio
async def test_createEvent_single(user: User, session, async_client):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat("2021-01-11T09:30:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": calendar.id,
    }

    resp = await async_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
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
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)
    event = {
        "title": "laundry",
        "start": '20210111T050000Z',  # start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": calendar.id,
    }

    rule = """
        DTSTART:20210111T050000Z
        RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5
    """
    event['recurrences'] = [r.strip() for r in rule.split('\n') if r.strip()]
    resp = await async_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert resp.status_code == 422

    event['recurrences'] = ['RRULE:FREQ=DAILY;INTERVAL=1;COUNT=invalid']
    resp = await async_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_createEvent_recurring(user: User, session, async_client):
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
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert resp.status_code == 200

    result = await session.execute(select(Event).where(Event.user_id == user.id).limit(1))
    eventDb = result.scalar()

    assert eventDb.recurrences == recurrences

    events = list(getExpandedRecurringEvents(user, eventDb, {}, start, start + timedelta(days=5)))
    assert len(events) == 3


@pytest.mark.asyncio
async def test_createEvent_allDay(user: User, session, async_client):
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
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')
    assert eventResp.get('all_day') == True

    result = await session.execute(select(func.count()).where(Event.user_id == user.id))
    eventCount = result.scalar()

    assert eventCount == 1


@pytest.mark.asyncio
async def test_createEvent_withParticipants(user: User, session, async_client):
    """Create event with participants emails.
    If the user has the contact stored, make sure that it's linked to the participant.
    """

    # Setup Existing Contact
    contactEmail = 'jon@example.com'
    contact = Contact('Jon', 'Snow', contactEmail, 'test-img.png', None)
    user.contacts.append(contact)
    await session.commit()

    # Create Event with Participants

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
        "participants": [{'email': contactEmail}, {'email': 'adam@example.com'}],
    }

    resp = await async_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )

    assert len(resp.json().get('participants')) == 2

    eventId = resp.json().get('id')
    eventDb = (await session.execute(select(Event).where(Event.id == eventId))).scalar()
    for participant in eventDb.participants:
        if participant.email == contactEmail:
            assert participant.contact_id == contact.id

    # Make sure the event has the added participants

    res = await async_client.get(
        f'/api/v1/events/{eventId}', headers={'Authorization': getAuthToken(user)}
    )
    participants = res.json()['participants']

    assert len(participants) == 2
    assert participants[0]['email'] == contactEmail
    assert participants[0]['photo_url'] == 'test-img.png'


@pytest.mark.asyncio
async def test_updateEvent_recurring(user: User, session, async_client):
    """Modify for this & following events.
    TODO: Should delete outdated, overriden events.
    """
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event 2020-01-01 to 2020-01-10 => 10 events.
    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200110T120000Z']
    user.events.append(recurringEvent)

    events = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=20), session
    )
    assert len(events) == 10

    # With Override

    override = createOrUpdateEvent(None, events[8])
    override.title = 'Override'
    override.id = events[8].id
    user.events.append(override)
    await session.commit()

    # Trim the original event's instance list
    # Now, it starts from 2020-01-05.

    eventData = {
        "title": recurringEvent.title,
        "start": recurringEvent.start.isoformat(),
        "end": recurringEvent.end.isoformat(),
        "calendar_id": calendar.id,
        "recurrences": ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z'],
    }
    resp = await async_client.put(
        f'/api/v1/events/{recurringEvent.id}',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(eventData),
    )
    assert resp.status_code == 200

    events = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=20), session
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
        f'/api/v1/events/{event.id}', headers={'Authorization': getAuthToken(user)}
    )

    assert resp.status_code == 200
    result = await session.execute(user.getSingleEventsStmt())
    events = result.scalars().all()
    assert len(events) == 0


@pytest.mark.asyncio
async def test_deleteEvent_overrides(user: User, session, async_client):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z']
    user.events.append(recurringEvent)
    recurringEvent.user_id = user.id

    events = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=5), session
    )
    override = createOrUpdateEvent(None, events[2])
    override.title = 'Override'
    override.id = events[2].id
    user.events.append(override)
    await session.commit()

    result = await session.execute(select(func.count()).where(Event.user_id == user.id))
    eventCount = result.scalar()
    print(eventCount)

    assert eventCount == 2

    resp = await async_client.delete(
        f'/api/v1/events/{recurringEvent.id}', headers={'Authorization': getAuthToken(user)}
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
