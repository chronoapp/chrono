import uuid

from typing import Optional, List
from datetime import datetime
from app.db.models.event_participant import EventCreator, EventOrganizer

from app.db.models.user import User
from app.db.models.event import Event
from app.db.models.user_calendar import UserCalendar
from app.db.models.calendar import Calendar


def createCalendar(
    user: User,
    calendarId: uuid.UUID,
) -> UserCalendar:
    calendar = Calendar(calendarId, 'summary', 'description', 'America/Toronto', 'test@example.com')
    userCalendar = UserCalendar(
        calendarId, None, '#ffffff', '#000000', True, 'owner', True, False, []
    )
    userCalendar.calendar = calendar
    user.getDefaultAccount().calendars.append(userCalendar)

    return userCalendar


def createEvent(
    userCalendar: UserCalendar,
    start: datetime,
    end: datetime,
    googleId: Optional[str] = None,
    timezone: Optional[str] = None,
    recurrences: Optional[List[str]] = None,
    title: Optional[str] = 'Event',
    description: Optional[str] = 'Event description',
) -> Event:
    originalStart = None
    if recurrences:
        originalStart = start

    event = Event(
        googleId,
        title,
        description,
        start,
        end,
        None,
        None,
        timezone,
        recurrences,
        originalStart,
        None,
        None,
        EventCreator('test@rechrono.com', 'Test User', None),
        EventOrganizer(userCalendar.email, userCalendar.summary, None),
        False,
        True,
        True,
        None,
        None,
        True,
        [],
    )
    userCalendar.calendar.events.append(event)

    return event
