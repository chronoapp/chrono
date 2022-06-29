from uuid import uuid4
from typing import Optional, List

from datetime import datetime
from app.db.models.event_participant import EventCreator, EventOrganizer

from app.db.models.user import User
from app.db.models.event import Event
from app.db.models.user_calendar import UserCalendar
from app.db.models.calendar import Calendar


def createCalendar(
    user: User,
    calendarId: str,
):
    calendar = Calendar(calendarId, 'summary', 'description', 'America/Toronto', 'test@example.com')
    userCalendar = UserCalendar(
        calendarId,
        None,
        '#ffffff',
        '#000000',
        True,
        'owner',
        True,
        False,
    )
    userCalendar.calendar = calendar
    user.calendars.append(userCalendar)

    return userCalendar


def createEvent(
    userCalendar: UserCalendar,
    start: datetime,
    end: datetime,
    googleId: Optional[str] = None,
    timezone: Optional[str] = None,
    recurrences: Optional[List[str]] = None,
    title: Optional[str] = 'Event',
):
    originalStart = None
    if recurrences:
        originalStart = start

    event = Event(
        googleId,
        title,
        f'Event description',
        start,
        end,
        None,
        None,
        timezone,
        recurrences,
        originalStart,
        None,
        None,
        EventCreator('test-user@example.com', 'Test User', None),
        EventOrganizer('test-user-2@example.com', 'Test User 2', None),
    )
    userCalendar.calendar.events.append(event)

    return event
