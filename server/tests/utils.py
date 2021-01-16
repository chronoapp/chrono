from uuid import uuid4
from typing import Optional

from datetime import datetime

from app.db.models.event import Event
from app.db.models.calendar import Calendar


def createEvent(calendar: Calendar, start: datetime, end: datetime, timezone: Optional[str] = None):
    googleId = uuid4().hex
    event = Event(
        googleId,
        f'Event',
        f'Event description',
        start,
        end,
        None,
        None,
        calendar.id,
        timezone,
        None,
    )
    event.calendar = calendar
    event.user = calendar.user
    return event
