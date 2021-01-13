from uuid import uuid4

from datetime import datetime

from app.db.models.event import Event
from app.db.models.calendar import Calendar


def createEvent(calendar: Calendar, start: datetime, end: datetime):
    eventId = uuid4().hex
    event = Event(
        eventId,
        f'Event {eventId}',
        f'Event description {eventId}',
        start,
        end,
        None,
        None,
        calendar.id,
        None,
        None,
    )
    event.calendar = calendar
    event.user = calendar.user
    return event
