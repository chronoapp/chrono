import uuid
from typing import Optional, Dict, Tuple, List, Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dateutil.rrule import rrulestr
from googleapiclient.errors import HttpError
from app.db.models.access_control import AccessControlRule
from app.db.models.conference_data import (
    CommunicationMethod,
    ConferenceKeyType,
    ConferenceCreateStatus,
)
from app.db.models import User, Event, LabelRule, UserCalendar, Calendar, Webhook, EventAttendee

from app.core.logger import logger
from app.db.repos.contact_repo import ContactRepository
from app.db.repos.event_repo import EventRepository
from app.db.repos.event_utils import (
    EventBaseVM,
    EntryPointBaseVM,
    ConferenceDataBaseVM,
    ConferenceSolutionVM,
    CreateConferenceRequestVM,
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

GOOGLE_COLOR_MAPPING = {
    '#ac725e': '#795548',
    '#d06b64': '#e67c73',
    '#f83a22': '#d50000',
    '#fa573c': '#f4511e',
    '#ff7537': '#ef6c00',
    '#ffad46': '#f09300',
    '#42d692': '#009688',
    '#16a765': '#0b8043',
    '#7bd148': '#7cb342',
    '#b3dc6c': '#c0ca33',
    '#fbe983': '#e4c441',
    '#fad165': '#f6bf26',
    '#92e1c0': '#33b679',
    '#9fe1e7': '#039be5',
    '#9fc6e7': '#4285f4',
    '#4986e7': '#3f51b5',
    '#9a9cff': '#7986cb',
    '#b99aff': '#b39ddb',
    '#c2c2c2': '#616161',
    '#cabdbf': '#a79b8e',
    '#cca6ac': '#ad1457',
    '#f691b2': '#d81b60',
    '#cd74e6': '#8e24aa',
    '#a47ae2': '#9e69af',
}

PAGE_SIZE = 1000


class GoogleEventVM(EventBaseVM):
    google_id: Optional[str]
    recurring_event_g_id: Optional[str]


def convertToLocalTime(dateTime: datetime, timeZone: Optional[str]):
    if not timeZone:
        return dateTime

    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware


def mapGoogleColor(color: str) -> str:
    # Google maps to their material colors.
    if color in GOOGLE_COLOR_MAPPING:
        return GOOGLE_COLOR_MAPPING[color]
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
            userCalendar.selected = calendarItem.get('selected', True)
            userCalendar.access_role = calendarItem.get('accessRole')
            userCalendar.primary = calendarItem.get('primary', False)
            userCalendar.deleted = calendarItem.get('deleted')
        else:
            calId = uuid.uuid4()
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
                calendarItem.get('selected', True),
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

    # Instance of recurring event.
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
        userCalendar, existingEvent, eventVM, overrideId=overrideId, googleId=eventVM.google_id
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
            raise Exception(f'No start time for event: {eventVM.google_id}')

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


def conferenceDataToVM(conferenceData: Any) -> ConferenceDataBaseVM | None:
    """Parses conference data from Google to our ViewModel."""
    if not conferenceData:
        return None

    conferenceDataVM = None
    if conferenceData:
        createRequest = conferenceData.get('createRequest')

        createRequestVM = None
        if createRequest:
            createRequestVM = CreateConferenceRequestVM(
                request_id=createRequest.get('requestId'),
                conference_solution_key_type=ConferenceKeyType(
                    createRequest.get('conferenceSolutionKey', {}).get('type')
                ),
                status=ConferenceCreateStatus(createRequest.get('status', {}).get('statusCode')),
            )

        conferenceSolution = conferenceData.get('conferenceSolution')
        conferenceId = conferenceData.get('conferenceId')
        entrypoints = conferenceData.get('entryPoints')
        if entrypoints:
            entryPoints = [
                EntryPointBaseVM(
                    id=entrypoint.get('id'),
                    entry_point_type=CommunicationMethod(entrypoint.get('entryPointType')),
                    uri=entrypoint.get('uri'),
                    label=entrypoint.get('label'),
                    meeting_code=entrypoint.get('meetingCode'),
                    password=entrypoint.get('password'),
                )
                for entrypoint in entrypoints
            ]

        conferenceSolutionVM = None
        if conferenceSolution:
            conferenceType = conferenceSolution.get('key', {}).get('type')
            conferenceName = conferenceSolution.get('name')
            conferenceIconUri = conferenceSolution.get('iconUri')
            conferenceSolutionVM = ConferenceSolutionVM(
                name=conferenceName,
                key_type=ConferenceKeyType(conferenceType),
                icon_uri=conferenceIconUri,
            )

        conferenceDataVM = ConferenceDataBaseVM(
            conference_solution=conferenceSolutionVM,
            conference_id=conferenceId,
            entry_points=entryPoints,
            create_request=createRequestVM,
        )

    return conferenceDataVM


def googleEventToEventVM(calendarId: uuid.UUID, eventItem: Dict[str, Any]) -> GoogleEventVM:
    """Parses the google event to our ViewModel.
    TODO: Use Pydantic to validate and structure the data from google.
    """

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

    conferenceDataVM = conferenceDataToVM(eventItem.get('conferenceData'))
    location = eventItem.get('location')

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
        google_id=eventId,
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
        conference_data=conferenceDataVM,
        location=location,
    )
    return eventVM
