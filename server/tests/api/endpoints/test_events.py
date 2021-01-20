import json
from uuid import uuid4
from datetime import datetime, timedelta

from app.api.events.event_utils import getExpandedRecurringEvents
from app.api.endpoints.authentication import getAuthToken
from tests.utils import createEvent


def test_getEventsBasic(userSession, test_client):
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
    assert events[0].get('id') == event2.id
    assert events[1].get('id') == event1.id


def test_createEvent(userSession, test_client):
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


def test_createEvent_recurring_invalid(userSession, test_client):
    user, _ = userSession
    calendar = user.getPrimaryCalendar()
    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    rule = """
        DTSTART:20210111T050000Z
        RRULE:FREQ=DAILY;INTERVAL=1;COUNT=invalid
    """
    recurrences = [r.strip() for r in rule.split('\n') if r.strip()]

    event = {
        "title": "laundry",
        "start": '20210111T050000Z',  # start.isoformat(),
        "end": end.isoformat(),
        "calendar_id": calendar.id,
        "recurrences": recurrences,
    }

    resp = test_client.post(
        f'/api/v1/events/', headers={'Authorization': getAuthToken(user)}, data=json.dumps(event)
    )
    assert not resp.ok
    assert resp.status_code == 422


def test_createEvent_recurring(userSession, test_client):
    user, _ = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.fromisoformat("2021-01-11T05:00:00+00:00")
    end = start + timedelta(hours=1)

    rule = """
        DTSTART:20210111T050000Z
        RRULE:FREQ=DAILY;INTERVAL=1;COUNT=3
    """
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
    print(resp.json())

    eventDb = user.events.first()
    assert eventDb.recurrences == recurrences

    events = list(getExpandedRecurringEvents(eventDb, {}, start, start + timedelta(days=5)))
    assert len(events) == 3


def test_createEvent_allDay(userSession, test_client):
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


def test_deleteEvent(userSession, test_client):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.now()
    end = start + timedelta(hours=1)
    event = createEvent(calendar, start, end)
    session.commit()

    assert user.getEvents().count() == 1

    resp = test_client.delete(
        f'/api/v1/events/{event.id}', headers={'Authorization': getAuthToken(user)}
    )
    assert resp.ok
    assert resp.json().get('id') == event.id

    assert user.getEvents().count() == 0
