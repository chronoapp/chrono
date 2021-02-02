import json
from sqlalchemy.orm import Session
from typing import Tuple

from app.api.endpoints.authentication import getAuthToken

from tests.utils import createEvent
from app.db.models import User


def test_getCalendars(userSession: Tuple[User, Session], test_client):
    user, _ = userSession
    resp = test_client.get(f'/api/v1/calendars/', headers={'Authorization': getAuthToken(user)})

    calendars = resp.json()
    assert len(calendars) == 1


def test_postCalendar(userSession: Tuple[User, Session], test_client):
    user, _ = userSession

    calendarData = {
        'summary': 'my calendar',
        'backgroundColor': '#cccccc',
        'foregroundColor': '#ffffff',
        'description': 'this is an amazing calendar.',
        'selected': True,
        'primary': True,
    }

    resp = test_client.post(
        f'/api/v1/calendars/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(calendarData),
    )
    calendar = resp.json()
    assert calendar['id'] != None
    assert calendar['summary'] == calendarData['summary']

    assert user.calendars.count() == 2
