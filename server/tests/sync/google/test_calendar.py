import pytest
from typing import Tuple
from datetime import datetime

from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func

from app.db.models import User, Event
from app.sync.google.calendar import (
    syncEventsToDb,
    syncCreatedOrUpdatedGoogleEvent,
    syncDeletedEvent,
)

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


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_single(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    eventItem = EVENT_ITEM_RECURRING.copy()
    del eventItem['recurrence']

    event = await syncCreatedOrUpdatedGoogleEvent(calendar, None, eventItem, {}, session)
    await session.commit()

    assert event.title == eventItem.get('summary')
    assert event.g_id == eventItem.get('id')

    stmt = select(func.count()).where(Event.calendar_id == calendar.id)
    count = (await session.execute(stmt)).scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_recurring(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    event = await syncCreatedOrUpdatedGoogleEvent(calendar, None, EVENT_ITEM_RECURRING, {}, session)
    await session.commit()

    assert event.g_id == EVENT_ITEM_RECURRING.get('id')

    stmt = select(func.count()).where(Event.calendar_id == calendar.id)
    count = (await session.execute(stmt)).scalar()
    assert count == 1

    stmt = select(func.count()).where(Event.recurrences == None)
    nonRecurringCount = (await session.execute(stmt)).scalar()
    assert nonRecurringCount == 0


@pytest.mark.asyncio
async def test_syncCreatedOrUpdatedGoogleEvent_allDay(user, session):
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

    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    event = await syncCreatedOrUpdatedGoogleEvent(calendar, None, eventItem, {}, session)

    assert event.all_day
    assert event.start_day == '2020-12-25'
    assert event.end_day == '2020-12-26'
    assert event.start == datetime.fromisoformat('2020-12-25T00:00:00')
    assert event.end == datetime.fromisoformat('2020-12-26T00:00:00')


@pytest.mark.asyncio
async def test_syncEventsToDb_deleted(user, session):
    """TODO: Ensures that all child events are deleted when the parent
    recurring event is deleted.
    """
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    await syncEventsToDb(calendar, [EVENT_ITEM_RECURRING], session)
    await session.commit()

    stmt = select(Event).where(Event.calendar_id == calendar.id).options(selectinload(Event.labels))
    events = (await session.execute(stmt)).scalars().all()

    assert len(events) == 1
    assert events[0].status == 'active'

    # Remove the event.
    eventItem = EVENT_ITEM_RECURRING.copy()
    eventItem['status'] = 'cancelled'

    await syncEventsToDb(calendar, [eventItem], session)
    await session.commit()

    stmt = select(Event).where(Event.calendar_id == calendar.id).options(selectinload(Event.labels))
    events = (await session.execute(stmt)).scalars().all()

    assert len(events) == 1
    assert events[0].status == 'deleted'


@pytest.mark.asyncio
async def test_syncEventsToDb_recurring(user, session):
    """Event from 11:00-11:30pm: at 01-09, (EXCLUDE 01-10), 01-11, 01-12
    - UPDATE event's time at 01-10 -> 10-11
    - DELETE event at 01-12
    Result: [Event: 01-09, Event: 01-11 (updated)]
    """
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

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

    await syncEventsToDb(calendar, eventItems, session)
    await session.commit()

    parent = (
        await session.execute(select(Event).where(Event.g_id == '7bpp8ujgsitkcuk6h1er0nadfn'))
    ).scalar()

    events = (await session.execute(user.getSingleEventsStmt(showDeleted=True))).scalars().all()
    assert len(events) == 2

    for e in events:
        assert e.recurring_event.id == parent.id
