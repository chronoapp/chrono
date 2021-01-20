from uuid import uuid4
from typing import Optional

from datetime import datetime

from app.db.models.event import Event
from app.db.models.calendar import Calendar


def createEvent(
    calendar: Calendar,
    start: datetime,
    end: datetime,
    googleId: Optional[str] = None,
    timezone: Optional[str] = None,
):
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
        None,
        None,
        None,
    )
    event.calendar = calendar
    event.user = calendar.user
    return event
