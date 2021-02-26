import pytest
import json

from sqlalchemy import func, select

from app.api.endpoints.authentication import getAuthToken
from tests.utils import createEvent
from app.db.models import User, Calendar


@pytest.mark.asyncio
async def test_getCalendars(user, async_client):
    resp = await async_client.get(
        f'/api/v1/calendars/', headers={'Authorization': getAuthToken(user)}
    )

    calendars = resp.json()
    assert len(calendars) == 1


@pytest.mark.asyncio
async def test_postCalendar(user, session, async_client):

    calendarData = {
        'summary': 'my calendar',
        'backgroundColor': '#cccccc',
        'foregroundColor': '#ffffff',
        'description': 'this is an amazing calendar.',
        'selected': True,
        'primary': True,
    }

    resp = await async_client.post(
        f'/api/v1/calendars/',
        headers={'Authorization': getAuthToken(user)},
        data=json.dumps(calendarData),
    )

    calendar = resp.json()
    assert calendar['id'] != None
    assert calendar['summary'] == calendarData['summary']

    stmt = select(func.count()).where(Calendar.user_id == user.id)
    calendarsCount = (await session.execute(stmt)).scalar()

    assert calendarsCount == 2
