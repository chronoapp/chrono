from uuid import uuid4

from datetime import datetime, timedelta

from app.db.models.event import Event
from app.db.models.calendar import Calendar
from app.api.endpoints.authentication import getAuthToken


def createEvent(calendar: Calendar, start: datetime, end: datetime):
    eventId = uuid4().hex
    event = Event(eventId, f'Event {eventId}', f'Event description {eventId}', start, end, None,
                  None, calendar.id, None)
    event.calendar = calendar
    event.user = calendar.user
    return event


def test_getEventsBasic(userSession, test_client):
    user, _ = userSession
    calendar = user.getPrimaryCalendar()

    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    event1 = createEvent(calendar, start, start + timedelta(hours=1))

    start2 = start + timedelta(days=1)
    event2 = createEvent(calendar, start2, start2 + timedelta(minutes=30))

    token = getAuthToken(user)
    startFilter = (start - timedelta(days=1)).isoformat()
    resp = test_client.get(f'/api/v1/events/',
                           headers={'Authorization': token},
                           params={'start_date': startFilter})

    events = resp.json()
    assert len(events) == 2
    assert events[0].get('id') == event2.id
    assert events[1].get('id') == event1.id
