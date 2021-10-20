import pytest
from datetime import datetime, timedelta

from tests.utils import createEvent
from app.api.repos.event_repo import EventRepository


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
