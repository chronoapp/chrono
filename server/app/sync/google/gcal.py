from typing import Optional
from zoneinfo import ZoneInfo

from datetime import datetime
from app.db.models import Event, User, Calendar

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


"""Interfaces with Google Calendar API.
"""


def getCalendarService(user: User):
    credentials = Credentials(**user.credentials.token_data)
    service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)

    return service


def convertToLocalTime(dateTime: datetime, timeZone: Optional[str]):
    if not timeZone:
        return dateTime

    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware


def getEventBody(event: Event, timeZone: str):
    eventBody = {
        'summary': event.title_short,
        'description': event.description,
        'recurrence': event.recurrences,
    }

    if event.all_day:
        eventBody['start'] = {'date': event.start_day, 'timeZone': timeZone, 'dateTime': None}
        eventBody['end'] = {'date': event.end_day, 'timeZone': timeZone, 'dateTime': None}
    else:
        eventBody['start'] = {
            'dateTime': convertToLocalTime(event.start, timeZone).isoformat(),
            'timeZone': timeZone,
            'date': None,
        }
        eventBody['end'] = {
            'dateTime': convertToLocalTime(event.end, timeZone).isoformat(),
            'timeZone': timeZone,
            'date': None,
        }

    return eventBody


"""Handle writes from Timecouncil => Google
"""


def insertGoogleEvent(user: User, event: Event):
    timeZone = event.calendar.timezone
    eventBody = getEventBody(event, timeZone)

    return (
        getCalendarService(user)
        .events()
        .insert(calendarId=event.calendar_id, body=eventBody)
        .execute()
    )


def moveGoogleEvent(user: User, event: Event, prevCalendarId: str):
    """Moves an event to another calendar, i.e. changes an event's organizer."""
    return (
        getCalendarService(user)
        .events()
        .move(calendarId=prevCalendarId, eventId=event.g_id, destination=event.calendar_id)
        .execute()
    )


def updateGoogleEvent(user: User, event: Event):
    timeZone = event.calendar.timezone
    eventBody = getEventBody(event, timeZone)
    return (
        getCalendarService(user)
        .events()
        .patch(calendarId=event.calendar_id, eventId=event.g_id, body=eventBody)
        .execute()
    )


def deleteGoogleEvent(user: User, event: Event):
    return (
        getCalendarService(user)
        .events()
        .delete(calendarId=event.calendar_id, eventId=event.g_id)
        .execute()
    )


def createCalendar(user: User, calendar: Calendar):
    """Creates a calendar and adds it to my list."""
    body = {
        'summary': calendar.summary,
        'description': calendar.description,
        'timeZone': calendar.timezone,
    }
    return getCalendarService(user).calendars().insert(body=body).execute()


def updateCalendar(user: User, calendar: Calendar):
    body = {
        'selected': calendar.selected or False,
        'foregroundColor': calendar.foreground_color,
        'backgroundColor': calendar.background_color,
    }
    return (
        getCalendarService(user).calendarList().patch(calendarId=calendar.id, body=body).execute()
    )
