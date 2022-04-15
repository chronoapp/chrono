from typing import Optional
from zoneinfo import ZoneInfo

from datetime import datetime
from app.db.models import Event, User, UserCalendar

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


def insertGoogleEvent(userCalendar: UserCalendar, event: Event):
    timeZone = userCalendar.timezone
    eventBody = getEventBody(event, timeZone)

    return (
        getCalendarService(userCalendar.user)
        .events()
        .insert(calendarId=userCalendar.google_id, body=eventBody)
        .execute()
    )


def moveGoogleEvent(user: User, eventGoogleId: str, prevCalendarId: str, toCalendarId: str):
    """Moves an event to another calendar, i.e. changes an event's organizer."""
    return (
        getCalendarService(user)
        .events()
        .move(calendarId=prevCalendarId, eventId=eventGoogleId, destination=toCalendarId)
        .execute()
    )


def updateGoogleEvent(userCalendar: UserCalendar, event: Event):
    timeZone = userCalendar.timezone
    eventBody = getEventBody(event, timeZone)
    return (
        getCalendarService(userCalendar.user)
        .events()
        .patch(calendarId=userCalendar.google_id, eventId=event.g_id, body=eventBody)
        .execute()
    )


def deleteGoogleEvent(user: User, calendar: UserCalendar, event: Event):
    return (
        getCalendarService(user)
        .events()
        .delete(calendarId=calendar.google_id, eventId=event.g_id)
        .execute()
    )


def createCalendar(user: User, calendar: UserCalendar):
    """Creates a calendar and adds it to my list."""
    body = {
        'summary': calendar.summary,
        'description': calendar.description,
        'timeZone': calendar.timezone,
    }
    return getCalendarService(user).calendars().insert(body=body).execute()


def updateCalendar(user: User, calendar: UserCalendar):
    body = {
        'selected': calendar.selected or False,
        'foregroundColor': calendar.foreground_color,
        'backgroundColor': calendar.background_color,
    }
    return (
        getCalendarService(user)
        .calendarList()
        .patch(calendarId=calendar.google_id, body=body)
        .execute()
    )
