from uuid import uuid4
from typing import Optional, List

from datetime import datetime

from app.db.models.event import Event, EventCalendar
from app.db.models.user_calendar import UserCalendar


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
    )

    assoc = EventCalendar()
    assoc.event = event
    userCalendar.calendar.events.append(assoc)

    # TODO: Remove
    event.user = userCalendar.user

    return event
