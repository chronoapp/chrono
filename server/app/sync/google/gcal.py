from typing import Any, Optional, Literal, Dict
from uuid import uuid4
from zoneinfo import ZoneInfo
from datetime import datetime

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core import config
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
        if p.email
    ]

    eventBody = {
        'summary': event.title_short,
        'description': event.description,
        'recurrence': event.recurrences,
        'organizer': organizer,
        'attendees': participants,
        "guestsCanModify": event.guests_can_modify,
        "guestsCanInviteOthers": event.guests_can_invite_others,
        "guestsCanSeeOtherGuests": event.guests_can_see_other_guests,
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
    lockId and releaseLock(eventGoogleId, lockId)

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
    lockId and releaseLock(eventId, lockId)

    return resp


def deleteGoogleEvent(user: User, calendarId: str, eventId: str):
    lockId = acquireLock(eventId)
    resp = (
        getCalendarService(user).events().delete(calendarId=calendarId, eventId=eventId).execute()
    )
    lockId and releaseLock(eventId, lockId)

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


def addEventsWebhook(calendar: UserCalendar, ttlSeconds: int):
    """Subscribes to an event notification channel. The subscription lasts for 30 days."""
    webhookUrl = f'{config.API_URL}{config.API_V1_STR}/webhooks/google_events'
    uniqueId = uuid4().hex

    body = {
        'id': uniqueId,
        'address': webhookUrl,
        'type': 'web_hook',
        'params': {'ttl': ttlSeconds},
    }
    return (
        getCalendarService(calendar.user)
        .events()
        .watch(calendarId=calendar.google_id, body=body)
        .execute()
    )


def removeEventsWebhook(user: User, channelId: str, resourceId: str):
    body = {
        'id': channelId,
        'resourceId': resourceId,
    }
    return getCalendarService(user).channels().stop(body=body).execute()
