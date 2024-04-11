from typing import Literal
from uuid import uuid4
from datetime import timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.sync.google.converter import chronoToGoogleEvent
from app.sync.locking import acquireLock, releaseLock

from app.db.models import Event, UserCalendar, Calendar, UserAccount

"""Interfaces with Google Calendar API.

TODO: Make this interface deeper & don't expose Google's API directly.
"""
EVENTS_WEBHOOK_TTL_DAYS = 30
EVENTS_WEBHOOK_TTL_SECONDS = timedelta(days=EVENTS_WEBHOOK_TTL_DAYS).total_seconds()

SendUpdateType = Literal['all', 'externalOnly', 'none']


class GoogleAPIError(Exception):
    pass


class InvalidSyncToken(GoogleAPIError):
    pass


def getGoogleEvent(userCalendar: UserCalendar, eventId: str):
    return (
        _getCalendarService(userCalendar.account)
        .events()
        .get(calendarId=userCalendar.google_id, eventId=eventId)
        .execute()
    )


def getCalendarEvents(
    userCalendar: UserCalendar,
    timeMax: str | None,
    maxResults: int,
    syncToken: str | None,
    pageToken: str | None,
):
    """Returns events from the user's calendar.
    If there are repeating events, only return the base event.
    """
    try:
        return (
            _getCalendarService(userCalendar.account)
            .events()
            .list(
                calendarId=userCalendar.google_id,
                timeMax=timeMax,
                maxResults=maxResults,
                singleEvents=False,
                syncToken=syncToken,
                pageToken=pageToken,
            )
            .execute()
        )
    except HttpError as e:
        if e.resp.status == 410:
            raise InvalidSyncToken('Sync token is invalid')
        else:
            raise


def createGoogleEvent(
    userCalendar: UserCalendar,
    event: Event,
    sendUpdates: SendUpdateType,
):
    eventBody = chronoToGoogleEvent(event, userCalendar.timezone)

    return (
        _getCalendarService(userCalendar.account)
        .events()
        .insert(
            calendarId=userCalendar.google_id,
            body=eventBody,
            sendUpdates=sendUpdates,
            conferenceDataVersion=1,
        )
        .execute()
    )


def moveGoogleEvent(
    account: UserAccount,
    eventGoogleId: str,
    prevCalendarId: str,
    toCalendarId: str,
    sendUpdates: SendUpdateType,
):
    """Moves an event to another calendar, i.e. changes an event's organizer."""
    lockId = acquireLock(eventGoogleId)
    resp = (
        _getCalendarService(account)
        .events()
        .move(
            calendarId=prevCalendarId,
            eventId=eventGoogleId,
            destination=toCalendarId,
            sendUpdates=sendUpdates,
        )
        .execute()
    )
    lockId and releaseLock(eventGoogleId, lockId)

    return resp


def updateGoogleEvent(
    userCalendar: UserCalendar,
    event: Event,
    sendUpdates: SendUpdateType,
):
    if not event.google_id:
        raise ValueError('Event must have a google_id to update')

    eventBody = chronoToGoogleEvent(event, userCalendar.timezone)
    lockId = acquireLock(event.google_id)
    resp = (
        _getCalendarService(userCalendar.account)
        .events()
        .patch(
            calendarId=userCalendar.google_id,
            eventId=event.google_id,
            body=eventBody,
            sendUpdates=sendUpdates,
            conferenceDataVersion=1,
        )
        .execute()
    )
    lockId and releaseLock(event.google_id, lockId)

    return resp


def deleteGoogleEvent(
    account: UserAccount, calendarId: str, eventId: str, sendUpdates: SendUpdateType
):
    lockId = acquireLock(eventId)
    resp = (
        _getCalendarService(account)
        .events()
        .delete(calendarId=calendarId, eventId=eventId, sendUpdates=sendUpdates)
        .execute()
    )
    lockId and releaseLock(eventId, lockId)

    return resp


def updateUserCalendar(account: UserAccount, calendar: UserCalendar):
    body = {
        'selected': calendar.selected or False,
        'foregroundColor': calendar.foreground_color,
        'backgroundColor': calendar.background_color,
        'summaryOverride': calendar.summary_override,
        'description': calendar.description,
    }

    return (
        _getCalendarService(account)
        .calendarList()
        .patch(calendarId=calendar.google_id, body=body)
        .execute()
    )


def removeUserCalendar(account: UserAccount, calendar: UserCalendar):
    """Removes the calendar from my list.
    Does not delete the calendar from Google, but hides it.
    """

    return (
        _getCalendarService(account)
        .calendarList()
        .patch(
            calendarId=calendar.google_id,
            body={
                'hidden': True,
            },
        )
        .execute()
    )


def getUserCalendars(userAccount: UserAccount):
    return _getCalendarService(userAccount).calendarList().list().execute()


def getUserCalendar(account: UserAccount, calendarId: str):
    return _getCalendarService(account).calendarList().get(calendarId=calendarId).execute()


def getPrimaryCalendar(account: UserAccount):
    return _getCalendarService(account).calendars().get(calendarId='primary').execute()


def createCalendar(account: UserAccount, calendar: Calendar):
    """Creates a calendar and adds it to my list."""
    body = {
        'summary': calendar.summary,
        'description': calendar.description,
        'timeZone': calendar.timezone,
    }
    return _getCalendarService(account).calendars().insert(body=body).execute()


def updateCalendar(account: UserAccount, calendar: Calendar):
    """Updates a calendar and adds it to my list."""
    body = {
        'summary': calendar.summary,
        'description': calendar.description,
        'timeZone': calendar.timezone,
    }
    return (
        _getCalendarService(account)
        .calendars()
        .update(calendarId=calendar.google_id, body=body)
        .execute()
    )


def getAccessControlList(userCalendar: UserCalendar):
    """Returns the list of access control rules for the calendar.
    https://developers.google.com/calendar/api/v3/reference/acl
    """
    return (
        _getCalendarService(userCalendar.account)
        .acl()
        .list(calendarId=userCalendar.google_id)
        .execute()
    )


def addCalendarEventsWebhook(userCalendar: UserCalendar, webhookUrl: str):
    """Subscribes to an event notification channel to watch for events changes within a calendar.
    https://developers.google.com/calendar/api/v3/reference/events/watch
    """
    uniqueId = uuid4().hex

    body = {
        'id': uniqueId,
        'address': webhookUrl,
        'type': 'web_hook',
        'params': {'ttl': EVENTS_WEBHOOK_TTL_SECONDS},
    }
    return (
        _getCalendarService(userCalendar.account)
        .events()
        .watch(calendarId=userCalendar.google_id, body=body)
        .execute()
    )


def addCalendarListWebhook(account: UserAccount, webhookUrl: str):
    """Subscribes to an calendar list notification channel.
    https://developers.google.com/calendar/api/v3/reference/calendarList/watch
    """
    uniqueId = uuid4().hex

    body = {
        'id': uniqueId,
        'address': webhookUrl,
        'type': 'web_hook',
        'params': {'ttl': EVENTS_WEBHOOK_TTL_SECONDS},
    }
    return _getCalendarService(account).calendarList().watch(body=body).execute()


def removeWebhook(account: UserAccount, channelId: str, resourceId: str):
    """Stops watching resources through this channel.
    https://developers.google.com/calendar/api/v3/reference/channels/stop
    """
    body = {
        'id': channelId,
        'resourceId': resourceId,
    }
    return _getCalendarService(account).channels().stop(body=body).execute()


def _getCalendarService(userAccount: UserAccount):
    """Returns a Google Calendar API service for the user."""
    tokenData = userAccount.token_data

    credentials = Credentials(**tokenData)
    service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)

    return service
