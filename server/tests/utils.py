from uuid import uuid4
from typing import Optional, List

from datetime import datetime

from app.db.models.event import Event
from app.db.models.calendar import Calendar


def createEvent(
    calendar: Calendar,
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
        calendar.id,
        timezone,
        recurrences,
        originalStart,
        None,
        None,
    )
    event.calendar = calendar
    event.user = calendar.user
    return event
