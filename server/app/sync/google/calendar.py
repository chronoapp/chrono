from uuid import uuid4
from typing import Optional, Dict, Tuple, List, Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dateutil.rrule import rrulestr
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.db.session import AsyncSession
from app.db.models import User, Event, LabelRule, Calendar, Webhook
from app.core.logger import logger
from app.core import config
from app.api.repos.event_utils import (
    EventBaseVM,
    EventParticipantVM,
    createOrUpdateEvent,
    getRecurringEventId,
)
from app.api.repos.event_repo import EventRepository

from app.sync.google.gcal import getCalendarService

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


def syncGoogleCalendars(user: User):
    service = getCalendarService(user)
    calendarList = service.calendarList().list().execute()
    calendarsMap = {cal.id: cal for cal in user.calendars}

    for calendar in calendarList.get('items'):
        calId = calendar.get('id')
        calSummary = calendar.get('summary')

        print(f'Update Calendar: {calId}: {calSummary}')
        backgroundColor = mapGoogleColor(calendar.get('backgroundColor'))

        userCalendar = calendarsMap.get(calId)
        if userCalendar:
            userCalendar.google_id = calId
            userCalendar.timezone = calendar.get('timeZone')
            userCalendar.summary = calSummary
            userCalendar.description = calendar.get('description')
            userCalendar.background_color = backgroundColor
            userCalendar.foreground_color = calendar.get('foregroundColor')
            userCalendar.selected = calendar.get('selected')
            userCalendar.access_role = calendar.get('accessRole')
            userCalendar.primary = calendar.get('primary', False)
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
            userCalendar.google_id = calId
            user.calendars.append(userCalendar)


async def syncAllEvents(userId: int, fullSync: bool = False):
    """Syncs events from google calendar."""
    async with AsyncSession() as session:
        stmt = select(User).where(User.id == userId).options(selectinload(User.credentials))
        user = (await session.execute(stmt)).scalar()
        syncGoogleCalendars(user)

        await session.commit()

        for calendar in user.calendars:
            if calendar.google_id != None:
                await syncCalendar(calendar, session, fullSync=fullSync)

        await session.commit()


async def syncCalendar(calendar: Calendar, session: AsyncSession, fullSync: bool = False) -> None:
    service = getCalendarService(calendar.user)
    await createWebhook(calendar, session)

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

        await syncEventsToDb(calendar, events, session)

        if not nextPageToken:
            break

    calendar.sync_token = nextSyncToken
    await session.commit()


async def getEventWithCache(
    user: User, addedEventsCache: Dict[str, Event], googleEventId: str, session
) -> Optional[Event]:
    """Since we aren't committing on every event insert, store
    added / updated events in memory.
    """
    if googleEventId in addedEventsCache:
        return addedEventsCache[googleEventId]
    else:
        stmt = select(Event).where(Event.g_id == googleEventId, Event.user_id == user.id)
        result = await session.execute(stmt)

        return result.scalar()


async def syncEventsToDb(
    calendar: Calendar, eventItems: List[Dict[str, Any]], session: AsyncSession
) -> None:
    """Sync items from google to the calendar.

    Events could have been moved from one calendar to another.
    E.g. Move event E from calendar C1 to C2, but either could be synced first.
        If C1 first: Delete it, then added in sync(C2)
        If C2 first: Update the calendar ID, then sync(C1) skips the delete (calendar id does not match).

    TODO: There's no guarantee that the recurring event is expanded first.
    We know which recurring event it is with the composite id of {id}_{start_date}.
    """

    eventRepo = EventRepository(session)

    # Keep track of added events this session while the models have not been added to the db yet.
    addedEventsCache: Dict[str, Event] = {}

    for eventItem in eventItems:
        user = calendar.user
        googleEventId = eventItem['id']
        existingEvent = await getEventWithCache(user, addedEventsCache, googleEventId, session)

        if eventItem['status'] == 'cancelled':
            await syncDeletedEvent(calendar, existingEvent, eventItem, addedEventsCache, session)
        else:
            event = await syncCreatedOrUpdatedGoogleEvent(
                calendar, eventRepo, existingEvent, eventItem, addedEventsCache, session
            )

            await autoLabelEvents(event, user, session)

            addedEventsCache[event.g_id] = event

    await session.commit()


async def autoLabelEvents(event: Event, user: User, session: AsyncSession):
    """Auto adds labels based on the LabelRule."""

    if event.title:
        stmt = (
            select(LabelRule)
            .where(LabelRule.user_id == user.id)
            .filter(LabelRule.text.ilike(event.title))
            .options(selectinload(LabelRule.label))
        )
        result = await session.execute(stmt)
        labelRules = result.scalars().all()

        if len(labelRules) > 0:
            # Makes sure labels are refreshed.
            await session.refresh(event)

            for rule in labelRules:
                print(rule.label)
                if rule.label not in event.labels:
                    event.labels.append(rule.label)


async def syncDeletedEvent(
    calendar: Calendar,
    existingEvent: Optional[Event],
    eventItem: Dict[str, Any],
    addedEventsCache: Dict[str, Event],
    session: AsyncSession,
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
        baseRecurringEvent = await getOrCreateBaseRecurringEvent(
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


async def getOrCreateBaseRecurringEvent(
    calendar: Calendar,
    addedEventsCache: Dict[str, Event],
    googleRecurringEventId: str,
    session: AsyncSession,
) -> Event:
    """Retrieves the existing base recurring event, or make a stub event in case
    the parent has not been created yet. For the stub parent event, we only need a primary ID,
    since the rest of the info will be populated then the parent is synced.
    """
    user = calendar.user
    baseRecurringEvent = await getEventWithCache(
        user, addedEventsCache, googleRecurringEventId, session
    )

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
        await session.commit()

    return baseRecurringEvent


async def syncCreatedOrUpdatedGoogleEvent(
    calendar: Calendar,
    eventRepo: EventRepository,
    existingEvent: Optional[Event],
    eventItem: Dict[str, Any],
    addedEventsCache: Dict[str, Event],
    session: AsyncSession,
) -> Event:
    """Syncs new event, or update existing from Google.
    For recurring events, translate the google reference to the internal event reference.
    """
    eventVM = googleEventToEventVM(calendar.id, eventItem)

    baseRecurringEvent = None
    if eventVM.recurring_event_g_id:
        baseRecurringEvent = await getOrCreateBaseRecurringEvent(
            calendar, addedEventsCache, eventVM.recurring_event_g_id, session
        )
        eventVM.recurring_event_id = baseRecurringEvent.id

    event = createOrUpdateEvent(existingEvent, eventVM, googleId=eventVM.g_id)
    calendar.user.events.append(event)

    await eventRepo.updateEventParticipants(calendar.user, event, eventVM.participants)

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
            originalStartDay = originalStartTime.get('date')

    recurrence = eventItem.get('recurrence')
    recurringEventGId = eventItem.get('recurringEventId')
    status = convertStatus(eventItem['status'])

    participants = []
    for attendee in eventItem.get('attendees', []):
        participant = EventParticipantVM(
            id=attendee.get('id'),
            display_name=attendee.get('displayName'),
            email=attendee.get('email'),
            response_status=attendee.get('responseStatus'),
        )
        participants.append(participant)

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
        participants=participants,
    )
    return eventVM


async def createWebhook(calendar: Calendar, session) -> None:
    """Create a webhook for the calendar to watche for event updates."""
    if not config.API_URL:
        logger.debug(f'No API URL specified.')
        return

    # TODO: Fix lazy select
    # Only one webhook per calendar

    stmt = select(Webhook).where(Webhook.calendar_id == calendar.id)
    webhook = (await session.execute(stmt)).scalar()

    if webhook:
        logger.debug(f'Webhook exists.')
        return

    if calendar.access_role != 'owner':
        return

    uniqueId = uuid4().hex
    baseApiUrl = config.API_URL + config.API_V1_STR
    webhookUrl = f'{baseApiUrl}/webhooks/google_events'

    body = {'id': uniqueId, 'address': webhookUrl, 'type': 'web_hook'}
    resp = (
        getCalendarService(calendar.user)
        .events()
        .watch(calendarId=calendar.id, body=body)
        .execute()
    )
    webhook = Webhook(resp.get('id'), resp.get('resourceId'), resp.get('resourceUri'))
    webhook.calendar = calendar


def cancelWebhook(user: User, webhook: Webhook, session: AsyncSession):
    body = {'resourceId': webhook.resource_id, 'id': webhook.id}

    try:
        resp = getCalendarService(user).channels().stop(body=body).execute()
    except HttpError as e:
        logger.error(e)

    session.delete(webhook)
