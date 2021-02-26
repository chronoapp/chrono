import pytest
from uuid import uuid4

from typing import Tuple
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from datetime import datetime, timedelta
from dateutil.rrule import DAILY, WEEKLY

from app.db.models import User, Calendar, Event
from app.api.events.event_utils import (
    EventBaseVM,
    getAllExpandedRecurringEvents,
    getAllExpandedRecurringEventsList,
    createOrUpdateEvent,
    verifyRecurringEvent,
    InputError,
)

from tests.utils import createEvent


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_override(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-01-02T12:00:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1))

    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;UNTIL=20200107T120000Z']
    user.events.append(recurringEvent)

    # Expanded recurring events between 2 dates.
    events = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=1), session
    )
    assert len(events) == 2

    events = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=10), session
    )
    assert len(events) == 6

    delta = events[1].start - events[0].start
    assert delta.days == 1

    # Override one recurring event.
    event = createOrUpdateEvent(None, events[1])
    event.title = 'Override'
    event.id = events[1].id
    user.events.append(event)
    await session.commit()

    events = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=1), session
    )
    assert events[1].title == 'Override'


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_withTimezone(user, session):
    # TODO: Test expansions with timezone info in EXDate
    recurrences = [
        'EXDATE;TZID=America/Toronto:20201019T213000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
    ]


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_fullDay(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

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
    await session.commit()

    recurringEvents = await getAllExpandedRecurringEventsList(
        user, start, start + timedelta(days=100), session
    )

    firstStart = datetime.strptime('2020-12-27', "%Y-%m-%d")
    for idx, e in enumerate(recurringEvents):
        expectedStart = firstStart + timedelta(days=7 * idx)
        assert e.start_day == expectedStart.strftime('%Y-%m-%d')
        expectedEnd = expectedStart + timedelta(days=1)
        assert e.end_day == expectedEnd.strftime('%Y-%m-%d')


@pytest.mark.asyncio
async def test_verifyRecurringEvent(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(calendar, start, start + timedelta(hours=1), timezone='UTC')

    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    user.events.append(recurringEvent)
    await session.commit()

    # Assert that verifyRecurringEvent raises exceptions if the ID is invalid.
    validEventId = f'{recurringEvent.id}_20201202T120000Z'
    invalidEventId1 = f'{recurringEvent.id}_1212'
    invalidEventId2 = f'{recurringEvent.id}_20211202T120000Z'

    # Re-query to merge with labels joined.
    recurringEvent = (
        await session.execute(select(Event).where(Event.id == recurringEvent.id))
    ).scalar()

    verifyRecurringEvent(user, validEventId, recurringEvent)

    with pytest.raises(InputError):
        verifyRecurringEvent(user, invalidEventId1, recurringEvent)

    with pytest.raises(InputError):
        verifyRecurringEvent(user, invalidEventId2, recurringEvent)
