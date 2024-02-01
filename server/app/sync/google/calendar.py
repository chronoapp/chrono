import uuid
from typing import Optional, Dict, List, Any
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dateutil.rrule import rrulestr
from app.core.logger import logger


from app.db.models.access_control import AccessControlRule
from app.db.models.conference_data import (
    CommunicationMethod,
    ConferenceKeyType,
    ConferenceCreateStatus,
)
from app.db.models import (
    User,
    Event,
    LabelRule,
    UserCalendar,
    Calendar,
    Webhook,
    EventAttendee,
    ReminderOverride,
    ReminderMethod,
    UserAccount,
)

from app.db.models.event import Transparency, Visibility
from app.db.repos.contact_repo import ContactRepository
from app.db.repos.acl_repo import ACLRepository
from app.db.repos.event_repo.event_repo import (
    EventRepository,
    getRecurringEventId,
    createOrUpdateEvent,
)
from app.db.repos.event_repo.view_models import (
    ConferenceDataBaseVM,
    ConferenceSolutionVM,
    CreateConferenceRequestVM,
    EntryPointBaseVM,
    EventBaseVM,
    EventParticipantVM,
    ReminderOverrideVM,
)

from app.sync.google import gcal
from .view_models import GoogleCalendarEvent, ConferenceData

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


def syncGoogleCalendars(
    account: UserAccount, calendarList, session: Session, removeDeleted: bool = True
):
    calendarsMap = {cal.google_id: cal for cal in account.calendars}

    # Add and update calendars
    for calendarItem in calendarList:
        gCalId = calendarItem.get('id')
        calSummary = calendarItem.get('summary')

        backgroundColor = mapGoogleColor(calendarItem.get('backgroundColor'))
        defaultReminders = [
            ReminderOverride(ReminderMethod(r.get('method')), r.get('minutes'))
            for r in calendarItem.get('defaultReminders', [])
        ]

        userCalendar = calendarsMap.get(gCalId)
        if userCalendar:
            userCalendar.summary_override = calendarItem.get('summaryOverride')
            userCalendar.calendar.timezone = calendarItem.get('timeZone')
            userCalendar.calendar.summary = calSummary
            userCalendar.calendar.description = calendarItem.get('description')
            userCalendar.calendar.timezone = calendarItem.get('timeZone')

            userCalendar.google_id = gCalId
            userCalendar.background_color = backgroundColor
            userCalendar.foreground_color = calendarItem.get('foregroundColor')
            userCalendar.selected = calendarItem.get('selected', False)
            userCalendar.access_role = calendarItem.get('accessRole')
            userCalendar.primary = calendarItem.get('primary', False)
            userCalendar.deleted = calendarItem.get('deleted')
            userCalendar.reminders = defaultReminders
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
                defaultReminders,
            )
            userCalendar.google_id = gCalId
            userCalendar.calendar = calendar
            userCalendar.account = account
            session.add(userCalendar)

        # Sync ACL
        if userCalendar.access_role == 'owner':
            aclRepo = ACLRepository(session)
            syncAccessControlList(userCalendar, aclRepo)

    # Remove deleted calendars
    if removeDeleted:
        existingCalendarIds = set(calendarsMap.keys())
        googleCalendarIds = set([cal.get('id') for cal in calendarList])
        deletedCalendarGoogleIds = existingCalendarIds - googleCalendarIds

        for googleCalendarId in deletedCalendarGoogleIds:
            userCalendar = calendarsMap.get(googleCalendarId)
            if userCalendar:
                calendar = userCalendar.calendar
                session.delete(userCalendar)
                session.delete(calendar)
                session.commit()


def syncAccessControlList(userCalendar: UserCalendar, aclRepo: ACLRepository):
    aclResult = gcal.getAccessControlList(userCalendar)

    for aclRule in aclResult.get('items'):
        aclId = aclRule.get('id')

        existingAcl = aclRepo.getAccessControlRuleByGoogleId(aclId)
        if not existingAcl:
            scope = aclRule.get('scope')
            scopeType = scope.get('type')
            scopeValue = scope.get('value')

            acl = AccessControlRule(aclRule.get('id'), aclRule.get('role'), scopeType, scopeValue)
            userCalendar.calendar.access_control_rules.append(acl)


def syncAllCalendars(user: User, session: Session):
    """Syncs calendars and access control list from google calendar."""
    for account in user.getGoogleAccounts():
        calendarList = gcal.getUserCalendars(account)
        syncGoogleCalendars(account, calendarList.get('items'), session)


def syncCalendar(account: UserAccount, calendarId: str, session: Session):
    calendar = gcal.getUserCalendar(account, calendarId)
    syncGoogleCalendars(account, [calendar], session, removeDeleted=False)


def syncCalendarEvents(calendar: UserCalendar, session: Session, fullSync: bool = False) -> None:
    end = (datetime.utcnow() + timedelta(days=30)).isoformat() + 'Z'
    nextPageToken = None

    while True:
        isIncrementalSync = calendar.sync_token and not fullSync
        if isIncrementalSync:
            try:
                eventsResult = gcal.getCalendarEvents(
                    calendar,
                    None if calendar.sync_token else end,
                    PAGE_SIZE,
                    calendar.sync_token,
                    nextPageToken,
                )

            except gcal.InvalidSyncToken as e:
                # Indicates the sync token is invalid => do a full sync.
                calendar.sync_token = None
                continue
        else:
            eventsResult = gcal.getCalendarEvents(
                calendar,
                end,
                PAGE_SIZE,
                None,
                nextPageToken,
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
        user = calendar.account.user
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
            True,
            [],
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
            True,
            [],
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
    contactRepo = ContactRepository(userCalendar.account.user, session)
    updatedParticipants = []
    event.participants.clear()

    for participantVM in participants:
        contact = contactRepo.findContact(participantVM)

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


def conferenceDataToVM(conferenceData: ConferenceData | None) -> ConferenceDataBaseVM | None:
    """Parses conference data from Google to our ViewModel."""
    if not conferenceData:
        return None

    conferenceDataVM = None

    createRequestVM = None
    if conferenceData.createRequest:
        createRequestVM = CreateConferenceRequestVM(
            request_id=conferenceData.createRequest.requestId,
            conference_solution_key_type=ConferenceKeyType(
                conferenceData.createRequest.conferenceSolutionKey.type
            ),
            status=ConferenceCreateStatus(conferenceData.createRequest.status.statusCode),
        )

    conferenceId = conferenceData.conferenceId
    entrypoints = conferenceData.entryPoints
    if entrypoints:
        entryPoints = [
            EntryPointBaseVM(
                entry_point_type=CommunicationMethod(entrypoint.entryPointType),
                uri=entrypoint.uri,
                label=entrypoint.label,
                meeting_code=entrypoint.meetingCode,
                password=entrypoint.password,
            )
            for entrypoint in entrypoints
        ]

    conferenceSolutionVM = None
    if conferenceData.conferenceSolution:
        conferenceSolutionVM = ConferenceSolutionVM(
            name=conferenceData.conferenceSolution.name,
            key_type=ConferenceKeyType(conferenceData.conferenceSolution.key.type),
            icon_uri=conferenceData.conferenceSolution.iconUri,
        )

    conferenceDataVM = ConferenceDataBaseVM(
        conference_solution=conferenceSolutionVM,
        conference_id=conferenceId,
        entry_points=entryPoints,
        create_request=createRequestVM,
    )

    return conferenceDataVM


def googleEventToEventVM(calendarId: uuid.UUID, eventItem: Dict[str, Any]) -> GoogleEventVM:
    """Parses the google event to our internal ViewModel."""
    googleEvent = GoogleCalendarEvent.model_validate(eventItem)

    # Fix: There's no timezones for all day events..
    eventItemStart = googleEvent.start.dateTime or googleEvent.start.date
    assert eventItemStart is not None
    eventFullDayStart = googleEvent.start.date
    eventStart = datetime.fromisoformat(eventItemStart)

    eventItemEnd = googleEvent.end.dateTime or googleEvent.end.date
    assert eventItemEnd is not None
    eventFullDayEnd = googleEvent.end.date
    eventEnd = datetime.fromisoformat(eventItemEnd)

    timeZone = googleEvent.start.timeZone
    guestsCanModify = googleEvent.guestsCanModify
    guestsCanInviteOthers = googleEvent.guestsCanInviteOthers
    guestsCanSeeOtherGuests = googleEvent.guestsCanSeeOtherGuests

    conferenceDataVM = conferenceDataToVM(googleEvent.conferenceData)
    location = googleEvent.location

    originalStartTime = googleEvent.originalStartTime
    originalStartDateTime = None
    originalStartDay = None
    if originalStartTime:
        if originalStartTime.dateTime:
            originalStartDateTime = datetime.fromisoformat(originalStartTime.dateTime)
        if originalStartTime.date:
            originalStartDay = originalStartTime.date

    recurrence = googleEvent.recurrence
    recurringEventGId = googleEvent.recurringEventId
    status = convertStatus(googleEvent.status)

    participants = []

    for attendee in googleEvent.attendees:
        participant = EventParticipantVM(
            display_name=attendee.displayName,
            email=attendee.email,
            response_status=attendee.responseStatus,
        )
        participants.append(participant)

    creatorVM = None
    if googleEvent.creator:
        creatorVM = EventParticipantVM(
            email=googleEvent.creator.email, display_name=googleEvent.creator.displayName
        )

    organizerVM = None
    if googleEvent.organizer:
        organizerVM = EventParticipantVM(
            email=googleEvent.organizer.email, display_name=googleEvent.organizer.displayName
        )

    reminderOverrides = (
        [
            ReminderOverrideVM(method=ReminderMethod(r.method), minutes=r.minutes)
            for r in googleEvent.reminders.overrides
        ]
        if googleEvent.reminders
        else None
    )

    eventVM = GoogleEventVM(
        google_id=googleEvent.id,
        title=googleEvent.summary,
        status=status,
        description=googleEvent.description,
        start=eventStart,
        end=eventEnd,
        start_day=eventFullDayStart,
        end_day=eventFullDayEnd,
        calendar_id=calendarId,
        time_zone=timeZone,
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
        visibility=Visibility(googleEvent.visibility),
        transparency=Transparency(googleEvent.transparency),
        use_default_reminders=googleEvent.reminders.useDefault if googleEvent.reminders else True,
        reminders=reminderOverrides,
    )
    return eventVM
