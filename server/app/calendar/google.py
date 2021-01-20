from uuid import uuid4
from typing import Optional, Dict, Tuple, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from datetime import datetime, timedelta
from backports.zoneinfo import ZoneInfo
from dateutil.rrule import rrulestr
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.db.session import scoped_session
from app.db.models import User, Event, LabelRule, Calendar, Webhook
from app.core.logger import logger
from app.core import config
from app.api.events.event_utils import (
    EventBaseVM,
    createOrUpdateEvent,
    getRecurringEventId,
)

"""
Adapter to sync to and from google calendar.
Perhaps separate a common interface, ie.
- PutEvent: Event -> Result
- CreateCalendar: (Calendar) -> Result
"""

OLD_COLORS = [
    '#ac725e',
    '#d06b64',
    '#f83a22',
    '#fa573c',
    '#ff7537',
    '#ffad46',
    '#42d692',
    '#16a765',
    '#7bd148',
    '#b3dc6c',
    '#fbe983',
    '#fad165',
    '#92e1c0',
    '#9fe1e7',
    '#9fc6e7',
    '#4986e7',
    '#9a9cff',
    '#b99aff',
    '#c2c2c2',
    '#cabdbf',
    '#cca6ac',
    '#f691b2',
    '#cd74e6',
    '#a47ae2',
]

NEW_COLORS = [
    '#795548',
    '#e67c73',
    '#d50000',
    '#f4511e',
    '#ef6c00',
    '#f09300',
    '#009688',
    '#0b8043',
    '#7cb342',
    '#c0ca33',
    '#e4c441',
    '#f6bf26',
    '#33b679',
    '#039be5',
    '#4285f4',
    '#3f51b5',
    '#7986cb',
    '#b39ddb',
    '#616161',
    '#a79b8e',
    '#ad1457',
    '#d81b60',
    '#8e24aa',
    '#9e69af',
]


class GoogleEventVM(EventBaseVM):
    g_id: str
    recurring_event_g_id: Optional[str]


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
    credentials = Credentials(**user.credentials.token_data)
    service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)

    return service


def syncGoogleCalendars(user: User):
    service = getService(user)
    calendarList = service.calendarList().list().execute()

    for calendar in calendarList.get('items'):
        calId = calendar.get('id')
        calSummary = calendar.get('summary')

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
            userCalendar = Calendar(
                calId,
                calendar.get('timeZone'),
                calSummary,
                calendar.get('description'),
                backgroundColor,
                calendar.get('foregroundColor'),
                calendar.get('selected'),
                calendar.get('accessRole'),
                calendar.get('primary'),
                calendar.get('deleted'),
            )
            user.calendars.append(userCalendar)


def syncAllEvents(userId: int, fullSync: bool = False):
    """Syncs events from google calendar."""
    with scoped_session() as session:
        user = session.query(User).filter(User.id == userId).first()
        syncGoogleCalendars(user)

        for calendar in user.calendars:
            syncCalendar(calendar, session, fullSync=fullSync)


def syncCalendar(calendar: Calendar, session: Session, fullSync: bool = False) -> None:
    service = getService(calendar.user)
    createWebhook(calendar)

    end = (datetime.utcnow() + timedelta(days=30)).isoformat() + 'Z'
    nextPageToken = None

    while True:
        if calendar.sync_token and not fullSync:
            try:
                eventsResult = (
                    service.events()
                    .list(
                        calendarId=calendar.id,
                        timeMax=None if calendar.sync_token else end,
                        maxResults=250,
                        singleEvents=False,
                        syncToken=calendar.sync_token,
                        pageToken=nextPageToken,
                    )
                    .execute()
                )
            except HttpError as e:
                if e.resp.status == 410:
                    # Indicates the sync token is invalid => do a full sync.
                    calendar.sync_token = None
                    continue
                else:
                    raise
        else:
            eventsResult = (
                service.events()
                .list(
                    calendarId=calendar.id,
                    timeMax=end,
                    maxResults=250,
                    singleEvents=False,
                    pageToken=nextPageToken,
                )
                .execute()
            )

        events = eventsResult.get('items', [])
        nextPageToken = eventsResult.get('nextPageToken')
        nextSyncToken = eventsResult.get('nextSyncToken')

        syncEventsToDb(calendar, events, session)

        if not nextPageToken:
            break

    calendar.sync_token = nextSyncToken
    session.commit()


def getEventWithCache(
    user: User, addedEventsCache: Dict[str, Event], googleEventId: str
) -> Optional[Event]:
    """Since we aren't committing on every event insert, store
    added / updated events in memory.
    """

    if googleEventId in addedEventsCache:
        return addedEventsCache[googleEventId]
    else:
        return user.events.filter(Event.g_id == googleEventId).one_or_none()


def syncEventsToDb(calendar: Calendar, eventItems: List[Dict[str, Any]], session: Session) -> None:
    """Sync items from google to the calendar.

    Events could have been moved from one calendar to another.
    E.g. Move event E from calendar C1 to C2, but either could be synced first.
        If C1 first: Delete it, then added in sync(C2)
        If C2 first: Update the calendar ID, then sync(C1) skips the delete (calendar id does not match).

    TODO: There's no guarantee that the recurring event is expanded first.
    We know which recurring event it is with the composite id of {id}_{start_date}.
    """

    # Keep track of added events this session while the models have not been added to the db yet.
    addedEventsCache: Dict[str, Event] = {}

    for eventItem in eventItems:
        user = calendar.user
        googleEventId = eventItem['id']
        existingEvent = getEventWithCache(user, addedEventsCache, googleEventId)
        if eventItem['status'] == 'cancelled':
            syncDeletedEvent(calendar, existingEvent, eventItem, addedEventsCache, session)
        else:
            event = syncCreatedOrUpdatedGoogleEvent(
                calendar, existingEvent, eventItem, addedEventsCache, session
            )

            # Auto Labelling
            if event.title:
                labelRules = user.label_rules.filter(LabelRule.text.ilike(event.title))
                for rule in labelRules:
                    if rule.label not in event.labels:
                        event.labels.append(rule.label)

            addedEventsCache[event.g_id] = event

    session.commit()


def syncDeletedEvent(
    calendar: Calendar,
    existingEvent: Optional[Event],
    eventItem: Dict[str, Any],
    addedEventsCache: Dict[str, Event],
    session: Session,
):
    """Sync deleted events to the DB.
    If the base event has not been created at this point, add a temporary event to the DB
    so that we can add a foreign key reference.
    """
    user = calendar.user

    if existingEvent and calendar.id == existingEvent.calendar_id:
        existingEvent.status = 'deleted'

    googleRecurringEventId = eventItem.get('recurringEventId')
    if not existingEvent and googleRecurringEventId:
        baseRecurringEvent = getOrCreateBaseRecurringEvent(
            calendar, addedEventsCache, googleRecurringEventId, session
        )

        googleEventId = eventItem.get('id')
        startDateTime = eventItem['originalStartTime']
        originalTimezone = startDateTime.get('timeZone')
        if startDateTime.get('dateTime'):
            startDt = datetime.fromisoformat(startDateTime.get('dateTime'))
            startDay = None
            recurringEventId = getRecurringEventId(baseRecurringEvent.id, startDt, False)
        else:
            startDt = datetime.fromisoformat(startDateTime.get('date'))
            startDay = startDt.strftime('%Y-%m-%d')
            recurringEventId = getRecurringEventId(baseRecurringEvent.id, startDt, True)

        event = Event(
            googleEventId,
            None,
            None,
            None,
            None,
            None,
            None,
            calendar.id,
            None,
            None,
            startDt,
            startDay,
            originalTimezone,
            status=convertStatus(eventItem['status']),
        )
        event.id = recurringEventId
        event.recurring_event = baseRecurringEvent

        user.events.append(event)
        addedEventsCache[event.g_id] = event


def getOrCreateBaseRecurringEvent(
    calendar: Calendar,
    addedEventsCache: Dict[str, Event],
    googleRecurringEventId: str,
    session: Session,
) -> Event:
    """Retrieves the existing base recurring event, or make a stub event in case
    the parent has not been created yet. For the stub parent event, we only need a primary ID,
    since the rest of the info will be populated then the parent is synced.
    """
    user = calendar.user
    baseRecurringEvent = getEventWithCache(user, addedEventsCache, googleRecurringEventId)

    if not baseRecurringEvent:
        baseRecurringEvent = Event(
            googleRecurringEventId,
            None,
            None,
            None,
            None,
            None,
            None,
            calendar.id,
            None,
            None,
            None,
            None,
            None,
            status='active',
        )
        user.events.append(baseRecurringEvent)
        addedEventsCache[baseRecurringEvent.g_id] = baseRecurringEvent

    if not baseRecurringEvent.id:
        print(f'Add ID for Base: {baseRecurringEvent}')
        session.commit()

    return baseRecurringEvent


def syncCreatedOrUpdatedGoogleEvent(
    calendar: Calendar,
    existingEvent: Optional[Event],
    eventItem: Dict[str, Any],
    addedEventsCache: Dict[str, Event],
    session: Session,
) -> Event:
    """Syncs new event, or update existing from Google.
    For recurring events, translate the google reference to the internal event reference.
    """
    eventVM = googleEventToEventVM(calendar.id, eventItem)

    baseRecurringEvent = None
    if eventVM.recurring_event_g_id:
        baseRecurringEvent = getOrCreateBaseRecurringEvent(
            calendar, addedEventsCache, eventVM.recurring_event_g_id, session
        )
        eventVM.recurring_event_id = baseRecurringEvent.id

    event = createOrUpdateEvent(existingEvent, eventVM, googleId=eventVM.g_id)
    calendar.user.events.append(event)

    if baseRecurringEvent:
        recurringEventId = None
        if eventVM.original_start:
            recurringEventId = getRecurringEventId(
                baseRecurringEvent.id,
                eventVM.original_start,
                False,
            )
        elif eventVM.original_start_day:
            recurringEventId = getRecurringEventId(
                baseRecurringEvent.id,
                datetime.fromisoformat(eventVM.original_start_day),
                True,
            )
        else:
            raise Exception(f'No start time for event: {eventVM.g_id}')

        event.id = recurringEventId

    return event


def convertStatus(status: str):
    if status == 'tentative':
        return 'tentative'
    elif status == 'cancelled':
        return 'deleted'
    else:
        return 'active'


def googleEventToEventVM(calendarId: str, eventItem: Dict[str, Any]) -> GoogleEventVM:
    """Converts the google event to our ViewModel."""

    eventId = eventItem.get('id')

    # Fix: There's no timezones for all day events..
    eventItemStart = eventItem['start'].get('dateTime', eventItem['start'].get('date'))
    eventFullDayStart = eventItem['start'].get('date')
    eventStart = datetime.fromisoformat(eventItemStart)

    eventItemEnd = eventItem['end'].get('dateTime', eventItem['end'].get('date'))
    eventFullDayEnd = eventItem['end'].get('date')
    eventEnd = datetime.fromisoformat(eventItemEnd)
    eventSummary = eventItem.get('summary')
    eventDescription = eventItem.get('description')
    timeZone = eventItem['start'].get('timeZone')

    originalStartTime = eventItem.get('originalStartTime')
    originalStartDateTime = None
    originalStartDay = None
    if originalStartTime:
        if originalStartTime.get('dateTime'):
            originalStartDateTime = datetime.fromisoformat(originalStartTime.get('dateTime'))
        if originalStartTime.get('date'):
            originalStartDay = datetime.fromisoformat(originalStartTime.get('date'))

    recurrence = eventItem.get('recurrence')
    recurringEventGId = eventItem.get('recurringEventId')
    status = convertStatus(eventItem['status'])

    eventVM = GoogleEventVM(
        g_id=eventId,
        title=eventSummary,
        status=status,
        description=eventDescription,
        start=eventStart,
        end=eventEnd,
        start_day=eventFullDayStart,
        end_day=eventFullDayEnd,
        calendar_id=calendarId,
        timezone=timeZone,
        recurrences=recurrence,
        recurring_event_g_id=recurringEventGId,
        original_start=originalStartDateTime,
        original_start_day=originalStartDay,
    )
    return eventVM


"""Handle writes from Timecouncil => Google
"""


def insertGoogleEvent(user: User, event: Event):
    timeZone = event.calendar.timezone
    eventBody = getEventBody(event, timeZone)

    return getService(user).events().insert(calendarId=event.calendar_id, body=eventBody).execute()


def moveGoogleEvent(user: User, event: Event, prevCalendarId: str):
    """Moves an event to another calendar, i.e. changes an event's organizer."""
    return (
        getService(user)
        .events()
        .move(calendarId=prevCalendarId, eventId=event.g_id, destination=event.calendar_id)
        .execute()
    )


def updateGoogleEvent(user: User, event: Event):
    timeZone = event.calendar.timezone
    eventBody = getEventBody(event, timeZone)
    return (
        getService(user)
        .events()
        .patch(calendarId=event.calendar_id, eventId=event.g_id, body=eventBody)
        .execute()
    )


def deleteGoogleEvent(user: User, event: Event):
    return (
        getService(user).events().delete(calendarId=event.calendar_id, eventId=event.g_id).execute()
    )


def updateCalendar(user: User, calendar: Calendar):
    body = {
        'selected': calendar.selected or False,
        'foregroundColor': calendar.foreground_color,
        'backgroundColor': calendar.background_color,
    }
    return getService(user).calendarList().patch(calendarId=calendar.id, body=body).execute()


def createWebhook(calendar: Calendar) -> None:
    """Create a webhook for the calendar to watche for event updates."""
    if not config.API_URL:
        logger.debug(f'No API URL specified.')
        return

    # Only one webhook per calendar
    if calendar.webhook:
        logger.debug(f'Webhook exists.')
        return

    if calendar.access_role != 'owner':
        return

    uniqueId = uuid4().hex
    baseApiUrl = config.API_URL + config.API_V1_STR
    webhookUrl = f'{baseApiUrl}/webhooks/google_events'

    body = {'id': uniqueId, 'address': webhookUrl, 'type': 'web_hook'}
    resp = getService(calendar.user).events().watch(calendarId=calendar.id, body=body).execute()
    webhook = Webhook(resp.get('id'), resp.get('resourceId'), resp.get('resourceUri'))
    webhook.calendar = calendar


def cancelWebhook(user: User, webhook: Webhook, session: Session):
    body = {'resourceId': webhook.resource_id, 'id': webhook.id}

    try:
        resp = getService(user).channels().stop(body=body).execute()
    except HttpError as e:
        logger.error(e)

    session.delete(webhook)


def getEventBody(event: Event, timeZone: str):
    eventBody = {
        'summary': event.title,
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
