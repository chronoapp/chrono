from app.db.repos.calendar_repo import CalendarRepo


def test_get_calendar(user, session):
    """Test fetch calendar from CalendarRepo."""
    calRepo = CalendarRepo(session)
    userCalendar = calRepo.getPrimaryCalendar(user.id)

    calRepo = CalendarRepo(session)
    calendar = calRepo.getCalendar(user, userCalendar.id)

    assert calendar.id == userCalendar.id
