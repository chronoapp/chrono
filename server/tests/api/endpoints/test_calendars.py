import pytest
from sqlalchemy import func, select

from app.api.endpoints.authentication import getAuthToken
from app.db.models import UserCalendar


@pytest.mark.asyncio
async def test_getCalendar(user, async_client):
    userCalendar = user.calendars[0]

    resp = await async_client.get(
        f'/api/v1/calendars/{userCalendar.id}', headers={'Authorization': getAuthToken(user)}
    )

    assert resp.json().get('id') == userCalendar.id


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
        'source': 'chrono',
        'primary': True,
    }

    resp = await async_client.post(
        f'/api/v1/calendars/',
        headers={'Authorization': getAuthToken(user), 'Content-type': 'application/json'},
        json=calendarData,
    )

    calendar = resp.json()

    assert calendar['id'] != None
    assert calendar['summary'] == calendarData['summary']

    stmt = select(func.count()).where(UserCalendar.user_id == user.id)
    calendarsCount = (await session.execute(stmt)).scalar()

    assert calendarsCount == 2


@pytest.mark.asyncio
async def test_deleteCalendar(user, session, async_client):
    userCalendar = user.calendars[0]

    _resp = await async_client.delete(
        f'/api/v1/calendars/{userCalendar.id}', headers={'Authorization': getAuthToken(user)}
    )

    await session.refresh(user)
    assert len(user.calendars) == 0
