from typing import Any, Optional, Literal, Dict
from zoneinfo import ZoneInfo
from datetime import datetime

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.sync.locking import acquireLock, releaseLock
from app.db.models import Event, User, UserCalendar


"""Interfaces with Google Calendar API.
"""
SendUpdateType = Literal['all', 'externalOnly', 'none']


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
    organizer = {'email': event.organizer.email, 'displayName': event.organizer.display_name}
    participants = [
        {'email': p.email, 'displayName': p.display_name, 'responseStatus': p.response_status}
        for p in event.participants
    ]

    eventBody = {
        'summary': event.title_short,
        'description': event.description,
        'recurrence': event.recurrences,
        'organizer': organizer,
        'attendees': participants,
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


def getGoogleEvent(userCalendar: UserCalendar, eventId: str):
    return (
        getCalendarService(userCalendar.user)
        .events()
        .get(calendarId=userCalendar.id, eventId=eventId)
        .execute()
    )


def createGoogleEvent(
    user: User,
    googleCalendarId: str,
    eventBody: Dict[str, Any],
    sendUpdates: SendUpdateType = 'none',
):
    return (
        getCalendarService(user)
        .events()
        .insert(
            calendarId=googleCalendarId,
            body=eventBody,
            sendUpdates=sendUpdates,
        )
        .execute()
    )


def moveGoogleEvent(user: User, eventGoogleId: str, prevCalendarId: str, toCalendarId: str):
    """Moves an event to another calendar, i.e. changes an event's organizer."""
    lockId = acquireLock(eventGoogleId)
    resp = (
        getCalendarService(user)
        .events()
        .move(calendarId=prevCalendarId, eventId=eventGoogleId, destination=toCalendarId)
        .execute()
    )
    releaseLock(eventGoogleId, lockId)

    return resp


def updateGoogleEvent(
    user: User,
    calendarId: str,
    eventId: str,
    eventBody: Dict[str, Any],
    sendUpdates: SendUpdateType = 'none',
):
    lockId = acquireLock(eventId)
    resp = (
        getCalendarService(user)
        .events()
        .patch(
            calendarId=calendarId,
            eventId=eventId,
            body=eventBody,
            sendUpdates=sendUpdates,
        )
        .execute()
    )
    releaseLock(eventId, lockId)

    return resp


def deleteGoogleEvent(user: User, calendarId: str, eventId: str):
    lockId = acquireLock(eventId)
    resp = (
        getCalendarService(user).events().delete(calendarId=calendarId, eventId=eventId).execute()
    )
    releaseLock(eventId, lockId)

    return resp


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
