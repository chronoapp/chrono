import logging
from typing import Optional

from datetime import datetime, timedelta
from backports.zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.db.session import scoped_session
from app.db.models import User, Event, LabelRule, Calendar
from app.core.logger import logger
"""
Adapter to sync to and from google calendar.
"""

OLD_COLORS = [
    '#ac725e', '#d06b64', '#f83a22', '#fa573c', '#ff7537', '#ffad46', '#42d692', '#16a765',
    '#7bd148', '#b3dc6c', '#fbe983', '#fad165', '#92e1c0', '#9fe1e7', '#9fc6e7', '#4986e7',
    '#9a9cff', '#b99aff', '#c2c2c2', '#cabdbf', '#cca6ac', '#f691b2', '#cd74e6', '#a47ae2'
]
NEW_COLORS = [
    '#795548', '#e67c73', '#d50000', '#f4511e', '#ef6c00', '#f09300', '#009688', '#0b8043',
    '#7cb342', '#c0ca33', '#e4c441', '#f6bf26', '#33b679', '#039be5', '#4285f4', '#3f51b5',
    '#7986cb', '#b39ddb', '#616161', '#a79b8e', '#ad1457', '#d81b60', '#8e24aa', '#9e69af'
]


def convertToLocalTime(dateTime: datetime, timeZone: Optional[str]):
    if not timeZone:
        return dateTime

    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware


def mapGoogleColor(color: str) -> str:
    # Google maps to their material colors. TODO: combine map.

    if color in OLD_COLORS:
        return NEW_COLORS[OLD_COLORS.index(color)]
    else:
        return color


def getService(user: User):
    credentials = Credentials(**user.credentials.toDict())
    service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)

    return service


def syncGoogleCalendar(userId: int, startDaysAgo: int = 30, endDaysAgo: int = 0):
    """Syncs events from google calendar.
    """
    with scoped_session() as session:
        user = session.query(User).filter(User.id == userId).first()

        credentials = Credentials(**user.credentials.toDict())
        service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)
        calendarList = service.calendarList().list().execute()

        for calendar in calendarList.get('items'):
            calId = calendar.get('id')
            calSummary = calendar.get('summary')

            prev = (datetime.utcnow() - timedelta(days=startDaysAgo)).isoformat() + 'Z'
            end = (datetime.utcnow() - timedelta(days=endDaysAgo)).isoformat() + 'Z'

            print(f'Update Calendar: {calId}: {calSummary}')
            backgroundColor = mapGoogleColor(calendar.get('backgroundColor'))

            userCalendar = user.calendars.filter_by(id=calId).first()
            if userCalendar:
                userCalendar.timezone = calendar.get('timeZone')
                userCalendar.summary = calSummary
                userCalendar.description = calendar.get('description')
                userCalendar.background_color = backgroundColor
                userCalendar.foreground_color = calendar.get('foregroundColor')
                userCalendar.selected = calendar.get('selected')
                userCalendar.access_role = calendar.get('accessRole')
                userCalendar.primary = calendar.get('primary')
                userCalendar.deleted = calendar.get('deleted')
            else:
                userCalendar = Calendar(calId, calendar.get('timeZone'), calSummary,
                                        calendar.get('description'), backgroundColor,
                                        calendar.get('foregroundColor'), calendar.get('selected'),
                                        calendar.get('accessRole'), calendar.get('primary'),
                                        calendar.get('deleted'))
                user.calendars.append(userCalendar)

            nextPageToken = None
            while True:
                eventsResult = service.events().list(calendarId=calId,
                                                     timeMax=end,
                                                     timeMin=prev,
                                                     maxResults=250,
                                                     singleEvents=True,
                                                     pageToken=nextPageToken,
                                                     orderBy='startTime').execute()

                events = eventsResult.get('items', [])
                nextPageToken = eventsResult.get('nextPageToken')

                print(f'Token: {nextPageToken}')
                syncEventsToDb(userCalendar, events)
                session.commit()

                if not nextPageToken:
                    break


def syncEventsToDb(calendar: Calendar, eventItems):
    newEvents = 0
    updatedEvents = 0

    for event in eventItems:
        eventId = event['id']
        eventStart = datetime.fromisoformat(event['start'].get('dateTime',
                                                               event['start'].get('date')))
        eventEnd = datetime.fromisoformat(event['end'].get('dateTime', event['end'].get('date')))
        eventSummary = event.get('summary')
        eventDescription = event.get('description')

        timeZone = event['start'].get('timeZone')

        user = calendar.user
        event = user.events.filter(Event.g_id == eventId).first()
        if not event:
            # New event
            newEvents += 1
            event = Event(eventId, eventSummary, eventDescription, eventStart, eventEnd,
                          calendar.id)
            user.events.append(event)
        else:
            # Update Event
            updatedEvents += 1
            event.title = eventSummary
            event.description = eventDescription
            event.start = eventStart
            event.end = eventEnd
            event.time_zone = timeZone

        # Auto Labelling
        if event.title:
            labelRules = user.label_rules.filter(LabelRule.text.ilike(event.title))
            for rule in labelRules:
                if rule.label not in event.labels:
                    event.labels.append(rule.label)

    logger.info(f'Updated {updatedEvents} events.')
    logger.info(f'Added {newEvents} events.')


def insertGoogleEvent(user: User, event: Event):
    timeZone = event.calendar.timezone
    eventBody = getEventBody(event, timeZone)

    return getService(user).events().insert(calendarId=event.calendar_id, body=eventBody).execute()


def updateGoogleEvent(user: User, event: Event):
    timeZone = event.calendar.timezone
    eventBody = getEventBody(event, timeZone)
    return getService(user).events().patch(calendarId=event.calendar_id,
                                           eventId=event.g_id,
                                           body=eventBody).execute()


def deleteGoogleEvent(user: User, event: Event):
    credentials = Credentials(**user.credentials.toDict())
    service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)

    return service.events().delete(calendarId=event.calendar_id, eventId=event.g_id).execute()


def getEventBody(event: Event, timeZone: str):
    eventBody = {
        'summary': event.title,
        'description': event.description,
        'start': {
            'dateTime': convertToLocalTime(event.start, timeZone).isoformat(),
        },
        'end': {
            'dateTime': convertToLocalTime(event.end, timeZone).isoformat(),
        },
    }

    return eventBody