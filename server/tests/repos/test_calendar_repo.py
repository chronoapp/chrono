from app.db.models import User
from app.db.repos.calendar_repo import CalendarRepository


def test_get_calendar(user: User, session):
    """Test fetch calendar from CalendarRepo."""
    calRepo = CalendarRepository(session)
    userCalendar = calRepo.getPrimaryCalendar(user.id)

    calRepo = CalendarRepository(session)
    calendar = calRepo.getCalendar(user, userCalendar.id)

    assert calendar.id == userCalendar.id
