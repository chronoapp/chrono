from uuid import uuid4

from typing import Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from dateutil.rrule import DAILY, WEEKLY

from app.db.models import User
from app.api.events.event_utils import (
    getRRule,
    EventBaseVM,
    getAllExpandedRecurringEvents,
    createOrUpdateEvent,
)

from tests.utils import createEvent


def test_getAllExpandedRecurringEvents_override(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-01-02T12:00:00-05:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1))
    rule = getRRule(start, DAILY, 1, None, (start + timedelta(days=5)))

    # TODO: Write the rule with timezone?
    recurrence = """
    DTSTART:20200102T120000Z
    RRULE:FREQ=DAILY;UNTIL=20200107T120000Z
    """
    recurringEvent.recurrences = [recurrence]
    user.events.append(recurringEvent)

    # Expanded recurring events between 2 dates.
    events = list(getAllExpandedRecurringEvents(user, start, start + timedelta(days=1), session))
    assert len(events) == 2

    events = list(getAllExpandedRecurringEvents(user, start, start + timedelta(days=10), session))
    assert len(events) == 6

    delta = events[1].start - events[0].start
    assert delta.days == 1

    # Override one recurring event.
    event = createOrUpdateEvent(None, events[1])
    event.title = 'Override'
    event.id = events[1].id
    user.events.append(event)
    session.commit()

    events = list(getAllExpandedRecurringEvents(user, start, start + timedelta(days=1), session))
    assert events[1].title == 'Override'


def test_getAllExpandedRecurringEvents_fullDay(userSession: Tuple[User, Session]):
    user, session = userSession
    calendar = user.getPrimaryCalendar()

    startDay = '2020-12-25'
    endDay = '2020-12-26'
    timezone = 'America/Los_Angeles'
    eventVM = EventBaseVM(
        title='Event',
        description='Test event description',
        start=datetime.strptime(startDay, "%Y-%m-%d"),
        end=datetime.strptime(endDay, "%Y-%m-%d"),
        start_day=startDay,
        end_day=endDay,
        calendar_id=calendar.id,
        timezone=timezone,
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
    )

    start = datetime.strptime(startDay, "%Y-%m-%d")
    event = createOrUpdateEvent(None, eventVM)
    user.events.append(event)
    session.commit()

    recurringEvents = getAllExpandedRecurringEvents(
        user, start, start + timedelta(days=100), session
    )

    firstStart = datetime.strptime('2020-12-27', "%Y-%m-%d")
    for idx, e in enumerate(recurringEvents):
        expectedStart = firstStart + timedelta(days=7 * idx)
        assert e.start_day == expectedStart.strftime('%Y-%m-%d')
        expectedEnd = expectedStart + timedelta(days=1)
        assert e.end_day == expectedEnd.strftime('%Y-%m-%d')
