from uuid import uuid4

from typing import Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from dateutil.rrule import DAILY, WEEKLY

from app.db.models import User
from app.db.models.event import Event
from app.db.models.calendar import Calendar
from app.api.endpoints.authentication import getAuthToken
from app.api.events.event_utils import getRRule, EventBaseVM, createRecurringEvents,\
    updateRecurringEvent, deleteRecurringEvent


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


def test_createRecurringEvents(userSession: Tuple[User, Session]):
    startDate = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    endDate = datetime.fromisoformat('2020-01-01T13:00:00-05:00')
    until = datetime(2020, 3, 15)

    testUser, _ = userSession
    calendar = testUser.getPrimaryCalendar()
    event = EventBaseVM(title='Test Event',
                        description='Test event description',
                        start=startDate,
                        end=endDate,
                        calendar_id=calendar.id)

    localTime = startDate.replace(tzinfo=None)

    # Bi-Weekly
    rule = getRRule(localTime, WEEKLY, 2, None, until)

    createRecurringEvents(testUser, [rule], event, 'America/Toronto')

    assert calendar.getEvents().count() == 6

    recurringEvent = calendar.getEvents(expandSingleEvents=False).one()

    for e in calendar.getEvents():
        if not e.is_parent_recurring_event:
            assert e.recurring_event_id == recurringEvent.id
        else:
            assert len(e.recurrences) == 1
            assert e.recurrences[0] == str(rule)


def test_createRecurringEvents_fullDay(userSession: Tuple[User, Session]):
    testUser, _ = userSession
    calendar = testUser.getPrimaryCalendar()

    startDay = '2020-12-25'
    endDay = '2020-12-26'
    timezone = 'America/Los_Angeles'
    eventVM = EventBaseVM(title='Event',
                          description='Test event description',
                          start=datetime.strptime(startDay, "%Y-%m-%d"),
                          end=datetime.strptime(endDay, "%Y-%m-%d"),
                          start_day=startDay,
                          end_day=endDay,
                          calendar_id=calendar.id,
                          recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'])

    rules = eventVM.getRRules(timezone)
    event, recurringEvents = createRecurringEvents(testUser, rules, eventVM, timezone)
    assert len(recurringEvents) == 5

    firstStart = datetime.strptime('2020-12-27', "%Y-%m-%d")
    for idx, e in enumerate(recurringEvents):
        expectedStart = firstStart + timedelta(days=7 * idx)
        assert e.start_day == expectedStart.strftime('%Y-%m-%d')
        expectedEnd = expectedStart + timedelta(days=1)
        assert e.end_day == expectedEnd.strftime('%Y-%m-%d')


def test_deleteRecurringEvent(userSession: Tuple[User, Session]):

    user, session = userSession
    startDate = datetime.fromisoformat('2020-01-01T12:00:00')
    endDate = datetime.fromisoformat('2020-01-01T13:00:00')
    calendar = user.getPrimaryCalendar()
    event = EventBaseVM(title='Test Event',
                        description='Test event description',
                        start=startDate,
                        end=endDate,
                        calendar_id=calendar.id)

    localTime = startDate.replace(tzinfo=None)

    # 5 events.
    rule = getRRule(localTime, DAILY, 1, 5, None)

    # delete all events
    createRecurringEvents(user, [rule], event, 'UTC')
    events = calendar.getEvents().order_by(Event.start.asc()).all()
    deleteRecurringEvent(user, events[2], 'ALL', session)
    session.commit()

    assert calendar.getEvents().count() == 0

    # delete this and following events.
    createRecurringEvents(user, [rule], event, 'UTC')
    events = calendar.getEvents().order_by(Event.start.asc()).all()
    deleteRecurringEvent(user, events[2], 'FOLLOWING', session)
    session.commit()

    assert calendar.getEvents().count() == 2
    user.events.delete()

    # delete single event
    createRecurringEvents(user, [rule], event, 'UTC')
    events = calendar.getEvents().order_by(Event.start.asc()).all()
    deleteRecurringEvent(user, events[2], 'SINGLE', session)
    session.commit()

    assert calendar.getEvents().count() == 4


def test_updateRecurringEvent(userSession: Tuple[User, Session]):
    user, session = userSession

    startDate = datetime.fromisoformat('2020-01-01T12:00:00')
    endDate = datetime.fromisoformat('2020-01-01T13:00:00')
    localTime = startDate.replace(tzinfo=None)

    calendar = user.getPrimaryCalendar()
    event = EventBaseVM(title='Test Event',
                        description='Test event description',
                        start=startDate,
                        end=endDate,
                        calendar_id=calendar.id)

    # One event every day for 5 days.
    rule = getRRule(localTime, DAILY, 1, 5, None)
    createRecurringEvents(user, [rule], event, 'UTC')
    events = calendar.getEvents().order_by(Event.start.asc()).all()

    # Update single event
    updateEvent = EventBaseVM(title='Test Event 2',
                              description='Test event description',
                              start=events[1].start,
                              end=events[1].end + timedelta(minutes=30),
                              calendar_id=calendar.id)

    updateRecurringEvent(user, events[1], updateEvent, 'SINGLE', session)
    session.commit()
    assert events[1].title == updateEvent.title
    assert events[1].start == updateEvent.start
    assert events[1].end == updateEvent.end

    # Update following events: Moved and changed names
    updateEvent2 = updateEvent.copy(update={
        'start': events[2].start + timedelta(minutes=30),
        'end': events[2].end + timedelta(minutes=30)
    })

    updateRecurringEvent(user, events[2], updateEvent2, 'FOLLOWING', session)
    for e in events[2:]:
        assert e.title == updateEvent2.title
        assert (e.end - e.start) == (updateEvent2.end - updateEvent2.start)

    # Update ALL FOLLOWING
    updateEvent3 = updateEvent.copy(update={
        'start': events[0].start + timedelta(hours=2),
        'end': events[0].end + timedelta(hours=2)
    })

    updateRecurringEvent(user, events[0], updateEvent3, 'ALL', session)
    for e in events:
        assert e.title == updateEvent3.title
        assert (e.end - e.start) == (updateEvent3.end - updateEvent3.start)

    # Update ALL
    originalStart = events[0].start
    selectedEvent = events[3]
    updateEvent4 = updateEvent.copy(update={
        'start': selectedEvent.start + timedelta(days=1),
        'end': selectedEvent.end + timedelta(days=1)
    })

    updateRecurringEvent(user, selectedEvent, updateEvent4, 'ALL', session)
    for idx, e in enumerate(events):
        print(e)
        updatedStart = originalStart + timedelta(days=idx + 1)
        assert e.start == updatedStart
