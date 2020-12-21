import json
from sqlalchemy.orm import Session
from typing import Tuple

from app.db.models import User, Event
from app.calendar.google import syncCreatedOrUpdatedGoogleEvent, syncDeletedEvent

EVENT_ITEM_RECURRING = {
    'kind': 'calendar#event',
    'etag': '"3214969133292000"',
    'id': '02kan06ornak4vngjaeem1rjhl',
    'status': 'confirmed',
    'htmlLink': 'https://www.google.com/calendar/event?eid=abc',
    'created': '2020-12-09T03:29:26.000Z',
    'updated': '2020-12-09T03:29:26.646Z',
    'summary': 'Test Recur',
    'creator': {
        'email': 'test-email@example.com',
        'self': True
    },
    'organizer': {
        'email': 'test-email@example.com',
        'self': True
    },
    'start': {
        'dateTime': '2020-12-09T11:00:00-05:00',
        'timeZone': 'America/Toronto'
    },
    'end': {
        'dateTime': '2020-12-09T12:00:00-05:00',
        'timeZone': 'America/Toronto'
    },
    'recurrence': ['RRULE:FREQ=DAILY;COUNT=5'],
    'iCalUID': '02kan06ornak4vngjaeem1rjhl@google.com',
    'sequence': 0,
    'reminders': {
        'useDefault': True
    }
}


def test_syncCreatedOrUpdatedGoogleEvent_single(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    event, _ = syncCreatedOrUpdatedGoogleEvent(calendar, None, eventItem)

    assert event.title == eventItem.get('summary')
    assert event.g_id == eventItem.get('id')
    assert calendar.getEvents().count() == 1


def test_syncCreatedOrUpdatedGoogleEvent_recurring(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    event, _ = syncCreatedOrUpdatedGoogleEvent(calendar, None, EVENT_ITEM_RECURRING)

    assert event.g_id == EVENT_ITEM_RECURRING.get('id')
    assert calendar.getEvents(False).count() == 1
    assert calendar.getEvents(True).count() == 5


def test_syncDeletedEvent(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    event, _ = syncCreatedOrUpdatedGoogleEvent(calendar, None, EVENT_ITEM_RECURRING)
    session.commit()
    assert calendar.getEvents().count() == 5

    syncDeletedEvent(calendar, event, session)

    assert calendar.events.count() == 0
