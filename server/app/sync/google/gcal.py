from typing import Any, Optional, Literal, Dict
from uuid import uuid4
from zoneinfo import ZoneInfo
from datetime import datetime

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core import config
from app.sync.locking import acquireLock, releaseLock
from app.db.models import Event, User, UserCalendar
from app.db.models.conference_data import ConferenceCreateStatus


"""Interfaces with Google Calendar API.

TODO: Make this interface deeper & don't expose Google's API directly.
"""
SendUpdateType = Literal['all', 'externalOnly', 'none']


def getCalendarService(user: User):
    credentials = Credentials(**user.credentials.token_data)
    service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)

    return service


def getEventBody(event: Event, timeZone: str):
    """TODO: Use the Pydantic Model for validation."""
    if event.organizer is None or event.start is None or event.end is None:
        raise ValueError('Event missing required fields')

    organizer = {'email': event.organizer.email, 'displayName': event.organizer.display_name}
    participants = [
        {'email': p.email, 'displayName': p.display_name, 'responseStatus': p.response_status}
        for p in event.participants
        if p.email
    ]

    eventBody: dict[str, Any] = {
        'summary': event.title_short,
        'description': event.description,
        'recurrence': event.recurrences,
        'organizer': organizer,
        'attendees': participants,
        'guestsCanModify': event.guests_can_modify,
        'guestsCanInviteOthers': event.guests_can_invite_others,
        'guestsCanSeeOtherGuests': event.guests_can_see_other_guests,
        'location': event.location,
        'visibility': event.visibility.value,
        'transparency': event.transparency.value,
    }

    if event.use_default_reminders:
        eventBody['reminders'] = {'useDefault': True}
    elif event.reminders is not None:
        eventBody['reminders'] = {
            'useDefault': False,
            'overrides': [
                {'method': reminder.method.value, 'minutes': reminder.minutes}
                for reminder in event.reminders
            ],
        }

    if event.conference_data is not None:
        if (
            event.conference_data.create_request
            and event.conference_data.create_request.status == ConferenceCreateStatus.PENDING
        ):
            eventBody['conferenceData'] = {
                'createRequest': {
                    'requestId': event.conference_data.create_request.request_id,
                    'conferenceSolutionKey': {
                        'type': event.conference_data.create_request.conference_solution_key_type.value
                    },
                }
            }
        else:
            eventBody['conferenceData'] = {
                'conferenceId': event.conference_data.conference_id,
            }

            if event.conference_data.conference_solution:
                eventBody['conferenceData']['conferenceSolution'] = {
                    'key': {'type': event.conference_data.conference_solution.key_type.value},
                    'name': event.conference_data.conference_solution.name,
                    'iconUri': event.conference_data.conference_solution.icon_uri,
                }

            eventBody['conferenceData']['entryPoints'] = [
                {
                    'entryPointType': entrypoint.entry_point_type.value,
                    'uri': entrypoint.uri,
                    'label': entrypoint.label,
                    'meetingCode': entrypoint.meeting_code,
                    'password': entrypoint.password,
                }
                for entrypoint in event.conference_data.entry_points
            ]
    else:
        eventBody['conferenceData'] = None

    if event.all_day:
        eventBody['start'] = {'date': event.start_day, 'timeZone': timeZone, 'dateTime': None}
        eventBody['end'] = {'date': event.end_day, 'timeZone': timeZone, 'dateTime': None}
    else:
        eventBody['start'] = {
            'dateTime': _convertToLocalTime(event.start, timeZone).isoformat(),
            'timeZone': timeZone,
            'date': None,
        }
        eventBody['end'] = {
            'dateTime': _convertToLocalTime(event.end, timeZone).isoformat(),
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
    sendUpdates: SendUpdateType,
):
    return (
        getCalendarService(user)
        .events()
        .insert(
            calendarId=googleCalendarId,
            body=eventBody,
            sendUpdates=sendUpdates,
            conferenceDataVersion=1,
        )
        .execute()
    )


def moveGoogleEvent(
    user: User,
    eventGoogleId: str,
    prevCalendarId: str,
    toCalendarId: str,
    sendUpdates: SendUpdateType,
):
    """Moves an event to another calendar, i.e. changes an event's organizer."""
    lockId = acquireLock(eventGoogleId)
    resp = (
        getCalendarService(user)
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
    user: User,
    calendarId: str,
    eventId: str,
    eventBody: Dict[str, Any],
    sendUpdates: SendUpdateType,
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
            conferenceDataVersion=1,
        )
        .execute()
    )
    lockId and releaseLock(eventId, lockId)

    return resp


def deleteGoogleEvent(user: User, calendarId: str, eventId: str, sendUpdates: SendUpdateType):
    lockId = acquireLock(eventId)
    resp = (
        getCalendarService(user)
        .events()
        .delete(calendarId=calendarId, eventId=eventId, sendUpdates=sendUpdates)
        .execute()
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
        'summaryOverride': calendar.summary_override,
        'description': calendar.description,
    }

    return (
        getCalendarService(user)
        .calendarList()
        .patch(calendarId=calendar.google_id, body=body)
        .execute()
    )


def removeCalendar(user: User, calendar: UserCalendar):
    """Removes the calendar from my list."""
    return getCalendarService(user).calendarList().delete(calendarId=calendar.google_id).execute()


def addEventsWebhook(calendar: UserCalendar, ttlSeconds: float, webhookUrl: str):
    """Subscribes to an event notification channel. The subscription lasts for 30 days."""
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


def _convertToLocalTime(dateTime: datetime, timeZone: Optional[str]):
    if not timeZone:
        return dateTime

    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware
