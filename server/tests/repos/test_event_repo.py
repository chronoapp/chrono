import pytest
from datetime import datetime, timedelta
from tests.utils import createEvent
from sqlalchemy import select

from app.db.models import Event
from app.api.repos.event_repo import EventRepository, verifyRecurringEvent, InputError


@pytest.mark.asyncio
async def test_event_repo_search(user, session):
    calendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()
    start = datetime.fromisoformat('2020-01-01T12:00:00-05:00')
    end = start + timedelta(hours=1)

    e1 = createEvent(calendar, start, end, title='Blueberry Pear')
    e2 = createEvent(calendar, start, end, title='Pear Grape')
    e3 = createEvent(calendar, start, end, title='Apple Banana')
    session.add(e1)
    session.add(e2)
    session.add(e3)
    await session.commit()

    eventRepo = EventRepository(session)
    events = await eventRepo.search(user.id, "Pear")

    assert len(events) == 2
    assert all('Pear' in e.title for e in events)


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
    recurringEvent = (await session.execute(select(Event).where(Event.id == recurringEvent.id))).scalar()

    verifyRecurringEvent(user, validEventId, recurringEvent)

    with pytest.raises(InputError):
        verifyRecurringEvent(user, invalidEventId1, recurringEvent)

    with pytest.raises(InputError):
        verifyRecurringEvent(user, invalidEventId2, recurringEvent)
