from sqlalchemy.orm import Session
from typing import Tuple
from datetime import datetime

from app.db.models import User, Event
from app.calendar.google import syncEventsToDb, syncCreatedOrUpdatedGoogleEvent, syncDeletedEvent

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


def test_syncCreatedOrUpdatedGoogleEvent_single(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    event = syncCreatedOrUpdatedGoogleEvent(calendar, None, eventItem, {}, session)

    assert event.title == eventItem.get('summary')
    assert event.g_id == eventItem.get('id')
    assert calendar.getEvents().count() == 1


def test_syncCreatedOrUpdatedGoogleEvent_recurring(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    event = syncCreatedOrUpdatedGoogleEvent(calendar, None, EVENT_ITEM_RECURRING, {}, session)

    assert event.g_id == EVENT_ITEM_RECURRING.get('id')
    assert calendar.getEvents().count() == 0


def test_syncCreatedOrUpdatedGoogleEvent_allDay(userSession: Tuple[User, Session]):
    user, session = userSession

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

    calendar = user.getPrimaryCalendar()
    event = syncCreatedOrUpdatedGoogleEvent(calendar, None, eventItem, {}, session)
    assert event.all_day
    assert event.start_day == '2020-12-25'
    assert event.end_day == '2020-12-26'
    assert event.start == datetime.fromisoformat('2020-12-25T00:00:00')
    assert event.end == datetime.fromisoformat('2020-12-26T00:00:00')


def test_syncEventsToDb_deleted(userSession: Tuple[User, Session]):
    """TODO: Ensures that all child events are deleted when the parent
    recurring event is deleted.
    """
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    syncEventsToDb(calendar, [EVENT_ITEM_RECURRING], session)
    assert user.events.count() == 1
    assert user.events.first().status == 'active'

    eventItem = EVENT_ITEM_RECURRING.copy()
    eventItem['status'] = 'cancelled'

    syncEventsToDb(calendar, [eventItem], session)
    assert user.events.count() == 1
    assert user.events.first().status == 'deleted'


def test_syncEventsToDb_recurring(userSession: Tuple[User, Session]):
    """Event from 11:00-11:30pm: at 01-09, (EXCLUDE 01-10), 01-11, 01-12
    - UPDATE event's time at 01-10 -> 10-11
    - DELETE event at 01-12
    Result: [Event: 01-09, Event: 01-11 (updated)]
    """
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    eventItems = [
        {
            "id": "7bpp8ujgsitkcuk6h1er0nadfn",
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
            "id": "7bpp8ujgsitkcuk6h1er0nadfn_20210111T040000Z",
            "status": "confirmed",
            "summary": "recurring-event",
            "start": {"dateTime": "2021-01-11T09:15:00-05:00"},
            "end": {"dateTime": "2021-01-11T09:45:00-05:00"},
            "recurringEventId": "7bpp8ujgsitkcuk6h1er0nadfn",
            "originalStartTime": {"dateTime": "2021-01-10T23:00:00-05:00"},
        },
        {
            "id": "7bpp8ujgsitkcuk6h1er0nadfn_20210113T040000Z",
            "status": "cancelled",
            "recurringEventId": "7bpp8ujgsitkcuk6h1er0nadfn",
            "originalStartTime": {"dateTime": "2021-01-12T23:00:00-05:00"},
        },
    ]

    syncEventsToDb(calendar, eventItems, session)

    parent = user.events.filter_by(g_id='7bpp8ujgsitkcuk6h1er0nadfn').first()
    events = user.getEvents(showDeleted=True).all()
    assert len(events) == 2

    for e in events:
        assert e.recurring_event.id == parent.id
