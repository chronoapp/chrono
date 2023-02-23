from sqlalchemy import func, select

from app.api.endpoints.authentication.token_utils import getAuthToken
from app.db.models import UserCalendar, User


def test_getCalendar(user: User, test_client):
    userCalendar = user.calendars[0]

    resp = test_client.get(
        f'/api/v1/calendars/{str(userCalendar.id)}', headers={'Authorization': getAuthToken(user)}
    )
    assert resp.json().get('id') == str(userCalendar.id)


def test_getCalendars(user, test_client):
    resp = test_client.get(f'/api/v1/calendars/', headers={'Authorization': getAuthToken(user)})

    calendars = resp.json()
    assert len(calendars) == 1


def test_postCalendar(user, session, test_client):
    calendarData = {
        'summary': 'my calendar',
        'backgroundColor': '#cccccc',
        'foregroundColor': '#ffffff',
        'description': 'this is an amazing calendar.',
        'selected': True,
        'source': 'chrono',
        'primary': True,
    }

    resp = test_client.post(
        f'/api/v1/calendars/',
        headers={'Authorization': getAuthToken(user), 'Content-type': 'application/json'},
        json=calendarData,
    )

    calendar = resp.json()

    assert calendar['id'] != None
    assert calendar['summary'] == calendarData['summary']

    stmt = select(func.count()).where(UserCalendar.user_id == user.id)
    calendarsCount = (session.execute(stmt)).scalar()

    assert calendarsCount == 2


def test_deleteCalendar(user, session, test_client):
    userCalendar = user.calendars[0]

    _resp = test_client.delete(
        f'/api/v1/calendars/{userCalendar.id}', headers={'Authorization': getAuthToken(user)}
    )

    session.refresh(user)
    assert len(user.calendars) == 0
