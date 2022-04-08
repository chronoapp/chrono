import pytest
from datetime import datetime, timedelta
from app.db.models.user_calendar import UserCalendar
from tests.utils import createEvent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Event, User
from app.api.repos.event_repo import (
    EventRepository,
    getRecurringEvent,
    InputError,
    getAllExpandedRecurringEventsList,
    getRecurringEventWithParent,
)
from app.api.repos.event_utils import EventBaseVM, createOrUpdateEvent, getRecurringEventId
from app.db.models.event import EventCalendar


@pytest.mark.asyncio
async def test_event_repo_search(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    createEvent(calendar, start, end, title='Blueberry Pear')
    createEvent(calendar, start, end, title='Pear Grape')
    createEvent(calendar, start, end, title='Apple Banana')
    await session.commit()

    eventRepo = EventRepository(session)
    events = await eventRepo.search(user.id, "Pear")

    assert len(events) == 2
    assert all('Pear' in e.title for e in events)


@pytest.mark.asyncio
async def test_event_repo_delete(user, session):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    e1 = createEvent(userCalendar, start, end, title='Blueberry Pear')
    session.add(e1)
    await session.commit()

    eventRepo = EventRepository(session)

    event = await eventRepo.getEvent(user, userCalendar, e1.id)
    assert event.status == 'active'

    await eventRepo.deleteEvent(user, userCalendar, e1.id)

    event = await eventRepo.getEvent(user, userCalendar, e1.id)
    assert event.status == 'deleted'


@pytest.mark.asyncio
async def test_event_repo_deleteRecurring(user: User, session: AsyncSession):
    userCalendar: UserCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    await session.commit()

    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-02T12:00:00'), False
    )

    eventRepo = EventRepository(session)
    event = await eventRepo.getEventVM(user, userCalendar, eventId)

    await eventRepo.deleteEvent(user, userCalendar, event.id)


@pytest.mark.asyncio
async def test_getRecurringEventWithParent(user, session):
    """Make sure we can fetch an instance of a recurring event and its parent."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    await session.commit()

    eventId = getRecurringEventId(
        recurringEvent.id, datetime.fromisoformat('2020-12-02T12:00:00'), False
    )
    event, parent = await getRecurringEventWithParent(userCalendar, eventId, session)

    assert event.recurring_event_id == parent.id
    assert parent.id == recurringEvent.id


@pytest.mark.asyncio
async def test_getRecurringEvent(user, session):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event.
    start = datetime.fromisoformat('2020-12-01T12:00:00')
    recurringEvent = createEvent(userCalendar, start, start + timedelta(hours=1), timezone='UTC')
    recurringEvent.recurrences = ['RRULE:FREQ=DAILY;COUNT=5']
    await session.commit()

    # Assert that getRecurringEvent raises exceptions if the ID is invalid.
    validEventId = f'{recurringEvent.id}_20201202T120000Z'
    invalidEventId1 = f'{recurringEvent.id}_1212'
    invalidEventId2 = f'{recurringEvent.id}_20211202T120000Z'

    # Re-query to merge with labels joined.
    recurringEvent = (
        await session.execute(select(Event).where(Event.id == recurringEvent.id))
    ).scalar()

    getRecurringEvent(userCalendar, validEventId, recurringEvent)

    with pytest.raises(InputError):
        getRecurringEvent(userCalendar, invalidEventId1, recurringEvent)

    with pytest.raises(InputError):
        getRecurringEvent(userCalendar, invalidEventId2, recurringEvent)


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_override(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    # Create a new recurring event. 01-02 to 01-07 => 6 events
    start = datetime.fromisoformat('2020-01-02T12:00:00')
    createEvent(
        calendar,
        start,
        start + timedelta(hours=1),
        recurrences=['RRULE:FREQ=DAILY;UNTIL=20200107T120000Z'],
    )

    # Expanded recurring events between 2 dates.
    events = await getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    assert len(events) == 2
    assert events[0].original_start == events[0].start

    # Expand all events.
    events = await getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=10), session
    )
    assert len(events) == 6

    delta = events[1].start - events[0].start
    assert delta.days == 1

    # Override one recurring event and ensure that it's updated.
    event = createOrUpdateEvent(None, events[1])
    event.title = 'Override'
    event.id = events[1].id

    ec = EventCalendar()
    ec.event = event
    calendar.calendar.events.append(ec)

    await session.commit()

    events = await getAllExpandedRecurringEventsList(
        user, calendar, start, start + timedelta(days=1), session
    )
    assert events[1].title == 'Override'


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_fullDay(user, session):
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

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
        calendar_id=userCalendar.id,
        timezone=timezone,
        recurrences=['FREQ=WEEKLY;BYDAY=SU;INTERVAL=1;COUNT=5'],
    )

    start = datetime.strptime(startDay, "%Y-%m-%d")
    createOrUpdateEvent(None, eventVM)
    await session.commit()

    recurringEvents = await getAllExpandedRecurringEventsList(
        user, userCalendar, start, start + timedelta(days=100), session
    )

    firstStart = datetime.strptime('2020-12-27', "%Y-%m-%d")
    for idx, e in enumerate(recurringEvents):
        expectedStart = firstStart + timedelta(days=7 * idx)
        assert e.start_day == expectedStart.strftime('%Y-%m-%d')
        expectedEnd = expectedStart + timedelta(days=1)
        assert e.end_day == expectedEnd.strftime('%Y-%m-%d')


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_override_toOutside(user, session):
    # TODO: Moved recurring event to outside a range.
    pass


@pytest.mark.asyncio
async def test_getAllExpandedRecurringEvents_withTimezone(user, session):
    # TODO: Test expansions with timezone info in EXDate
    recurrences = [
        'EXDATE;TZID=America/Toronto:20201019T213000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
    ]
