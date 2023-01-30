import shortuuid
from typing import Optional, Dict, Tuple, List, Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dateutil.rrule import rrulestr
from googleapiclient.errors import HttpError
from app.db.models.access_control import AccessControlRule

from app.db.models import User, Event, LabelRule, UserCalendar, Calendar, Webhook, EventAttendee
from app.core.logger import logger
from app.api.repos.contact_repo import ContactRepository
from app.api.repos.event_repo import EventRepository
from app.api.repos.event_utils import (
    EventBaseVM,
    EventParticipantVM,
    createOrUpdateEvent,
    getRecurringEventId,
)

from app.sync.google.gcal import getCalendarService, addEventsWebhook

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

PAGE_SIZE = 1000


class GoogleEventVM(EventBaseVM):
    g_id: Optional[str]
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


def syncGoogleCalendars(user: User, calendarList):
    calendarsMap = {cal.google_id: cal for cal in user.getGoogleCalendars()}

    for calendarItem in calendarList:
        gCalId = calendarItem.get('id')
        calSummary = calendarItem.get('summary')
        backgroundColor = mapGoogleColor(calendarItem.get('backgroundColor'))

        userCalendar = calendarsMap.get(gCalId)
        if userCalendar:
            userCalendar.calendar.timezone = calendarItem.get('timeZone')
            userCalendar.calendar.summary = calSummary
            userCalendar.calendar.description = calendarItem.get('description')
            userCalendar.calendar.timezone = calendarItem.get('timeZone')

            userCalendar.google_id = gCalId
            userCalendar.background_color = backgroundColor
            userCalendar.foreground_color = calendarItem.get('foregroundColor')
            userCalendar.selected = calendarItem.get('selected')
            userCalendar.access_role = calendarItem.get('accessRole')
            userCalendar.primary = calendarItem.get('primary', False)
            userCalendar.deleted = calendarItem.get('deleted')
        else:
            calId = shortuuid.uuid()
            calendar = Calendar(
                calId,
                calSummary,
                calendarItem.get('description'),
                calendarItem.get('timeZone'),
                None,
            )
            calendar.google_id = gCalId

            userCalendar = UserCalendar(
                calId,
                calendarItem.get('summaryOverride'),
                backgroundColor,
                calendarItem.get('foregroundColor'),
                calendarItem.get('selected'),
                calendarItem.get('accessRole'),
                calendarItem.get('primary'),
                calendarItem.get('deleted'),
            )
            userCalendar.google_id = gCalId
            userCalendar.calendar = calendar
            user.calendars.append(userCalendar)


def syncAccessControlList(userCalendar: UserCalendar, aclResult):
    for aclRule in aclResult.get('items'):
        scope = aclRule.get('scope')
        scopeType = scope.get('type')
        scopeValue = scope.get('value')

        acl = AccessControlRule(aclRule.get('id'), aclRule.get('role'), scopeType, scopeValue)
        userCalendar.calendar.access_control_rules.append(acl)


def syncAccessControlListAllCalendars(user: User, service):
    for calendar in user.getGoogleCalendars():
        if calendar.access_role == 'owner':
            aclResult = service.acl().list(calendarId=calendar.google_id).execute()
            syncAccessControlList(calendar, aclResult)


def syncCalendarsAndACL(user: User):
    """Syncs calendars and access control list from google calendar."""
    service = getCalendarService(user)
    calendarList = service.calendarList().list().execute()

    syncGoogleCalendars(user, calendarList.get('items'))
    syncAccessControlListAllCalendars(user, service)


def syncCalendarEvents(calendar: UserCalendar, session: Session, fullSync: bool = False) -> None:
    service = getCalendarService(calendar.user)
    end = (datetime.utcnow() + timedelta(days=30)).isoformat() + 'Z'
    nextPageToken = None

    while True:
        isIncrementalSync = calendar.sync_token and not fullSync
        if isIncrementalSync:
            try:
                eventsResult = (
                    service.events()
                    .list(
                        calendarId=calendar.google_id,
                        timeMax=None if calendar.sync_token else end,
                        maxResults=PAGE_SIZE,
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
                    calendarId=calendar.google_id,
                    timeMax=end,
                    maxResults=PAGE_SIZE,
                    singleEvents=False,
                    pageToken=nextPageToken,
                )
                .execute()
            )

        events = eventsResult.get('items', [])
        nextPageToken = eventsResult.get('nextPageToken')
        nextSyncToken = eventsResult.get('nextSyncToken')

        logger.info(f'Sync {len(events)} events for {calendar.summary}')
        syncEventsToDb(calendar, events, session)

        if not nextPageToken:
            break

    calendar.sync_token = nextSyncToken

    session.commit()


def syncEventsToDb(
    calendar: UserCalendar, eventItems: List[Dict[str, Any]], session: Session
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

    for eventItem in eventItems:
        user = calendar.user
        googleEventId = eventItem['id']
        existingEvent = eventRepo.getGoogleEvent(calendar, googleEventId)

        if eventItem['status'] == 'cancelled':
            syncDeletedEvent(calendar, existingEvent, eventItem, eventRepo, session)
        else:
            event = syncCreatedOrUpdatedGoogleEvent(
                calendar, eventRepo, existingEvent, eventItem, session
            )

            autoLabelEvents(event, user, session)

        session.commit()


def autoLabelEvents(event: Event, user: User, session: Session):
    """Auto adds labels based on the LabelRule."""

    if event.title:
        stmt = (
            select(LabelRule)
            .where(LabelRule.user_id == user.id)
            .filter(LabelRule.text.ilike(event.title))
            .options(selectinload(LabelRule.label))
        )
        result = session.execute(stmt)
        labelRules = result.scalars().all()

        if len(labelRules) > 0:
            # Makes sure labels are refreshed.
            session.refresh(event)

            for rule in labelRules:
                if rule.label not in event.labels:
                    event.labels.append(rule.label)


def syncDeletedEvent(
    userCalendar: UserCalendar,
    existingEvent: Optional[Event],
    eventItem: Dict[str, Any],
    eventRepo: EventRepository,
    session: Session,
):
    """Sync deleted events to the DB.

    If the base event has not been created at this point, add a temporary event to the DB
    so that we can add a foreign key reference.

    existingEvent is only None if it is a recurring event.
    """
    user = userCalendar.user

    if existingEvent:
        existingEvent.status = 'deleted'

    googleRecurringEventId = eventItem.get('recurringEventId')
    if not existingEvent and googleRecurringEventId:
        baseRecurringEvent = getOrCreateBaseRecurringEvent(
            userCalendar, googleRecurringEventId, eventRepo, session
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

        if not recurringEventId:
            raise Exception('Recurring event ID is None')

        event = Event(
            googleEventId,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            startDt,
            startDay,
            originalTimezone,
            None,
            None,
            None,
            None,
            None,
            status=convertStatus(eventItem['status']),
        )
        event.id = recurringEventId
        event.recurring_event_calendar_id = userCalendar.id
        event.recurring_event_id = baseRecurringEvent.id

        userCalendar.calendar.events.append(event)


def getOrCreateBaseRecurringEvent(
    userCalendar: UserCalendar,
    googleRecurringEventId: str,
    eventRepo: EventRepository,
    session: Session,
) -> Event:
    """Retrieves the existing base recurring event, or make a stub event in case
    the parent has not been created yet. For the stub parent event, we only need a primary ID,
    since the rest of the info will be populated then the parent is synced.
    """
    baseRecurringEvent = eventRepo.getGoogleEvent(userCalendar, googleRecurringEventId)

    if not baseRecurringEvent:
        baseRecurringEvent = Event(
            googleRecurringEventId,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            status='active',
        )
        userCalendar.calendar.events.append(baseRecurringEvent)

    if not baseRecurringEvent.id:
        session.commit()

    return baseRecurringEvent


def syncCreatedOrUpdatedGoogleEvent(
    userCalendar: UserCalendar,
    eventRepo: EventRepository,
    existingEvent: Optional[Event],
    eventItem: Dict[str, Any],
    session: Session,
) -> Event:
    """Syncs new event, or update existing from Google.
    For recurring events, translate the google reference to the internal event reference.
    """
    eventVM = googleEventToEventVM(userCalendar.id, eventItem)

    baseRecurringEvent = None
    overrideId = existingEvent.id if existingEvent else None
    if eventVM.recurring_event_g_id:
        baseRecurringEvent = getOrCreateBaseRecurringEvent(
            userCalendar, eventVM.recurring_event_g_id, eventRepo, session
        )

        # Case: we've moved a recurring event to another calendar
        if existingEvent and existingEvent.recurring_event_id != baseRecurringEvent.id:
            session.delete(existingEvent)
            session.commit()
            existingEvent = None

        eventVM.recurring_event_id = baseRecurringEvent.id

    event = createOrUpdateEvent(
        userCalendar, existingEvent, eventVM, overrideId=overrideId, googleId=eventVM.g_id
    )

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

        if not recurringEventId:
            raise Exception('Recurring event ID is None')

        event.id = recurringEventId

    syncEventParticipants(userCalendar, event, eventVM.participants, session)

    return event


def syncEventParticipants(
    userCalendar: UserCalendar,
    event: Event,
    participants: List[EventParticipantVM],
    session: Session,
):
    """Re-create event participants on google sync."""
    contactRepo = ContactRepository(session)
    updatedParticipants = []
    event.participants = []

    for participantVM in participants:
        contact = contactRepo.findContact(userCalendar.user, participantVM)

        participant = EventAttendee(
            participantVM.email,
            participantVM.display_name,
            contact.id if contact else None,
            participantVM.response_status,
        )
        updatedParticipants.append(participant)

    event.participants[:] = updatedParticipants


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
    guestsCanModify = eventItem.get('guestsCanModify', False)
    guestsCanInviteOthers = eventItem.get('guestsCanInviteOthers', True)
    guestsCanSeeOtherGuests = eventItem.get('guestsCanSeeOtherGuests', True)

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

    creatorVM = None
    if creator := eventItem.get('creator'):
        creatorVM = EventParticipantVM(
            email=creator.get('email'), display_name=creator.get('displayName')
        )

    organizerVM = None
    if organizer := eventItem.get('organizer'):
        organizerVM = EventParticipantVM(
            email=organizer.get('email'), display_name=organizer.get('displayName')
        )

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
        creator=creatorVM,
        organizer=organizerVM,
        guests_can_modify=guestsCanModify,
        guests_can_invite_others=guestsCanInviteOthers,
        guests_can_see_other_guests=guestsCanSeeOtherGuests,
    )
    return eventVM
