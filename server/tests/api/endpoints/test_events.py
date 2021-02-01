import json
from uuid import uuid4
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Tuple

from app.api.events.event_utils import (
    getExpandedRecurringEvents,
    getAllExpandedRecurringEvents,
    createOrUpdateEvent,
)
from app.api.endpoints.authentication import getAuthToken

from tests.utils import createEvent
from app.db.models import User


def test_getEventsBasic(userSession: Tuple[User, Session], test_client):
    user, _ = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(calendar, start, start + timedelta(hours=1))

    start2 = start + timedelta(days=1)
    event2 = createEvent(calendar, start2, start2 + timedelta(minutes=30))

    token = getAuthToken(user)
    startFilter = (start - timedelta(days=1)).isoformat()
    resp = test_client.get(
        f'/api/v1/events/', headers={'Authorization': token}, params={'start_date': startFilter}
    )

    events = resp.json()
    assert len(events) == 2
    assert events[0].get('id') == event1.id
    assert events[1].get('id') == event2.id


def test_createEvent(userSession: Tuple[User, Session], test_client):
    user, _ = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.fromisoformat("2021-01-11T09:30:00+00:00")
    end = start + timedelta(hours=1)

    event = {
        "title": "laundry",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": calendar.id,
    }

    resp = test_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')
    assert user.events.count() == 1

    eventDb = user.events.first()
    assert eventDb.title == event.get('title')
    assert eventDb.start == start
    assert eventDb.end == end
    assert not eventDb.all_day


def test_createEvent_recurring_invalid(userSession: Tuple[User, Session], test_client):
    """Malformed recurrence string."""
    user, _ = userSession
    calendar = user.getPrimaryCalendar()
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
    resp = test_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert not resp.ok
    assert resp.status_code == 422

    event['recurrences'] = ['RRULE:FREQ=DAILY;INTERVAL=1;COUNT=invalid']
    resp = test_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert not resp.ok
    assert resp.status_code == 422


def test_createEvent_recurring(userSession: Tuple[User, Session], test_client):
    user, _ = userSession
    calendar = user.getPrimaryCalendar()

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

    resp = test_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert resp.ok

    eventDb = user.events.first()
    assert eventDb.recurrences == recurrences

    events = list(getExpandedRecurringEvents(eventDb, {}, start, start + timedelta(days=5)))
    assert len(events) == 3


def test_createEvent_allDay(userSession: Tuple[User, Session], test_client):
    """TODO: API Should only need one of start / end and start_day / end_day"""
    user, _ = userSession
    calendar = user.getPrimaryCalendar()

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

    resp = test_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    eventResp = resp.json()

    assert eventResp.get('title') == event.get('title')
    assert eventResp.get('all_day') == True
    assert user.events.count() == 1


def test_updateEvent_recurring(userSession: Tuple[User, Session], test_client):
    """Modify for this & following events.
    TODO: Should delete outdated, overriden events.
    """
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200110T120000Z']
    user.events.append(recurringEvent)

    events = list(getAllExpandedRecurringEvents(user, start, start + timedelta(days=20), session))
    assert len(events) == 10

    # With Override

    override = createOrUpdateEvent(None, events[8])
    override.title = 'Override'
    override.id = events[8].id
    user.events.append(override)
    session.commit()

    # Trim the original event's instance list.

    eventData = {
        "title": recurringEvent.title,
        "start": recurringEvent.start.isoformat(),
        "end": recurringEvent.end.isoformat(),
        "calendar_id": calendar.id,
        "recurrences": ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z'],
    }
    resp = test_client.put(
        f'/api/v1/events/{recurringEvent.id}',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(eventData),
    )
    assert resp.ok

    events = list(getAllExpandedRecurringEvents(user, start, start + timedelta(days=20), session))
    assert len(events) == 5


def test_deleteEvent(userSession: Tuple[User, Session], test_client):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.now()
    end = start + timedelta(hours=1)
    event = createEvent(calendar, start, end)
    session.commit()

    assert user.getSingleEvents().count() == 1

    resp = test_client.delete(
        f'/api/v1/events/{event.id}', headers={'Authorization': getAuthToken(user)}
    )
    assert resp.ok
    assert user.getSingleEvents().count() == 0


def test_deleteEvent_overrides(userSession: Tuple[User, Session], test_client):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.fromisoformat('2020-01-01T12:00:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1))
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200105T120000Z']
    user.events.append(recurringEvent)
    recurringEvent.user_id = user.id

    events = list(getAllExpandedRecurringEvents(user, start, start + timedelta(days=5), session))
    override = createOrUpdateEvent(None, events[2])
    override.title = 'Override'
    override.id = events[2].id
    user.events.append(override)
    session.commit()

    assert user.events.count() == 2

    resp = test_client.delete(
        f'/api/v1/events/{recurringEvent.id}', headers={'Authorization': getAuthToken(user)}
    )

    assert resp.ok
    assert user.events.count() == 1
    assert user.events.first().status == 'deleted'
