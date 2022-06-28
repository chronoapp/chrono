import pytest

from app.api.repos.calendar_repo import CalendarRepo


@pytest.mark.asyncio
async def test_get_calendar(user, session):
    """Test fetch calendar from CalendarRepo."""
    userCalendar = (await session.execute(user.getPrimaryCalendarStmt())).scalar()

    calRepo = CalendarRepo(session)
    calendar = await calRepo.getCalendar(user, userCalendar.id)

    assert calendar.id == userCalendar.id
