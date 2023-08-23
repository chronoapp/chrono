import uuid

from datetime import datetime
from typing import List, Optional, Literal, Union
from dateutil.rrule import rrule, rruleset, rrulestr
from zoneinfo import ZoneInfo
from pydantic import BaseModel, field_validator, Field
from pydantic_core.core_schema import FieldValidationInfo

from app.api.endpoints.labels import LabelInDbVM
from app.db.models import Event, UserCalendar, EventCreator, EventOrganizer
from app.db.models.event import EventStatus, Visibility, Transparency
from app.db.models.event_participant import ResponseStatus
from app.db.models.conference_data import (
    ConferenceData,
    ConferenceSolution,
    ConferenceCreateRequest,
    ConferenceEntryPoint,
    CommunicationMethod,
    ConferenceKeyType,
    ConferenceCreateStatus,
)

"""Event models and helpers to manage Recurring Events.
"""


class EventParticipantVM(BaseModel):
    """Either one of email or contact ID is required."""

    id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    email: Optional[str] = None

    response_status: Optional[ResponseStatus] = 'needsAction'
    display_name: Optional[str] = None
    photo_url: Optional[str] = None
    is_self: Optional[bool] = None

    @field_validator("email")
    def validateContactAndEmail(
        cls, email: Optional[str], info: FieldValidationInfo
    ) -> Optional[str]:
        if email is None and info.data.get("contact_id") is None:
            raise ValueError("Either email or contact_id is required.")

        return email

    class Config:
        from_attributes = True


class EntryPointBaseVM(BaseModel):
    entry_point_type: CommunicationMethod
    uri: str
    label: str | None = None
    meeting_code: str | None = None
    password: str | None = None

    class Config:
        from_attributes = True


class CreateConferenceRequestVM(BaseModel):
    request_id: str = uuid.uuid4().hex
    status: ConferenceCreateStatus = ConferenceCreateStatus.PENDING
    conference_solution_key_type: ConferenceKeyType

    class Config:
        from_attributes = True


class ConferenceSolutionVM(BaseModel):
    name: str
    key_type: ConferenceKeyType
    icon_uri: str

    class Config:
        from_attributes = True


class ConferenceDataBaseVM(BaseModel):
    conference_id: str | None
    conference_solution: ConferenceSolutionVM | None

    # request to create conference
    create_request: CreateConferenceRequestVM | None

    # Linking EntryPoint
    entry_points: List[EntryPointBaseVM]

    class Config:
        from_attributes = True


class EntryPointVM(EntryPointBaseVM):
    id: uuid.UUID


class ConferenceDataVM(ConferenceDataBaseVM):
    id: uuid.UUID


class EventBaseVM(BaseModel):
    """Viewmodel for events.
    TODO: If we have start_day and end_day, we don't need start and end.
    """

    id: Optional[str] = None

    title: Optional[str] = None
    title_short: Optional[str] = None

    description: Optional[str] = None
    status: EventStatus = 'active'
    start: datetime
    end: datetime
    start_day: Optional[str] = None
    end_day: Optional[str] = None

    labels: List[LabelInDbVM] = []
    all_day: Optional[bool] = None
    timezone: Optional[str] = Field(alias='time_zone', default=None)
    calendar_id: Optional[uuid.UUID] = None
    recurrences: Optional[List[str]] = None
    recurring_event_id: Optional[str] = None

    participants: List[EventParticipantVM] = []
    creator: Optional[EventParticipantVM] = None
    organizer: Optional[EventParticipantVM] = None

    guests_can_modify: bool = False
    guests_can_invite_others: bool = True
    guests_can_see_other_guests: bool = True

    conference_data: ConferenceDataBaseVM | None = None
    location: Optional[str] = None
    visibility: Visibility | None = None
    transparency: Transparency | None = None

    # Read only fields.
    original_start: Optional[datetime] = None
    original_start_day: Optional[str] = None
    original_timezone: Optional[str] = None

    @field_validator('recurrences')
    def isValidRecurrence(
        cls, recurrences: Optional[List[str]], info: FieldValidationInfo
    ) -> Optional[List[str]]:
        """Makes sure the start and end dates aren't included in the recurrence, since they
        the event itself has these fields.
        """
        if recurrences and len(recurrences) > 0 and 'start' in info.data:
            recurrenceString = '\n'.join(recurrences)
            if 'DTSTART' in recurrenceString or 'DTEND' in recurrenceString:
                raise ValueError('Recurrence should not have DTSTART or DTEND')

            recurrenceToRuleSet(
                recurrenceString,
                info.data['timezone'] or 'UTC',
                info.data['start'],
                info.data['start_day'],
            )

        return recurrences

    def isAllDay(self) -> bool:
        return self.start_day is not None and self.end_day is not None

    class Config:
        from_attributes = True
        populate_by_name = True


class EventInDBVM(EventBaseVM):
    id: str


class GoogleEventInDBVM(EventInDBVM):
    google_id: Optional[str]


MAX_RECURRING_EVENT_COUNT = 1000

UpdateOption = Literal['SINGLE', 'ALL', 'FOLLOWING']


def recurrenceToRuleSet(
    recurrence: str, timezone: str, start: datetime, startDay: Optional[str]
) -> Union[rruleset, rrule]:
    """Gets the rrule objects from recurrence string array
    Converts to the local datetime in the timezone.
    """
    if not start and not startDay:
        raise ValueError('Either until or occurrences must be set.')

    if recurrence == '':
        raise ValueError('Recurrences must be non-empty.')

    if startDay is not None:
        localDate = datetime.strptime(startDay, "%Y-%m-%d")
        return rrulestr(recurrence, dtstart=localDate, ignoretz=True)
    else:
        localizedDate = start.astimezone(ZoneInfo(timezone))
        return rrulestr(recurrence, dtstart=localizedDate)


def getRRule(
    startDate: Optional[datetime],
    freq: int,
    interval: int,
    occurrences: Optional[int],
    until: Optional[datetime],
) -> rrule:
    if until and occurrences:
        raise ValueError('Until and occurrences cannot both be set.')
    if not until and not occurrences:
        raise ValueError('Either until or occurrences must be set.')

    count = None
    if not until:
        count = (
            min(MAX_RECURRING_EVENT_COUNT, occurrences)
            if occurrences
            else MAX_RECURRING_EVENT_COUNT
        )

    if count:
        rule = rrule(dtstart=startDate, freq=freq, interval=interval, count=count)
    else:
        rule = rrule(dtstart=startDate, freq=freq, interval=interval, until=until)

    return rule


def createOrUpdateEvent(
    userCalendar: UserCalendar,
    eventDb: Optional[Event],
    eventVM: EventBaseVM,
    overrideId: Optional[str] = None,
    googleId: Optional[str] = None,
) -> Event:
    recurrences = None if eventVM.recurring_event_id else eventVM.recurrences
    if creatorVM := eventVM.creator:
        creator = EventCreator(creatorVM.email, creatorVM.display_name, creatorVM.contact_id)
    else:
        creator = EventCreator(userCalendar.user.email, None, None)

    if organizerVM := eventVM.organizer:
        organizer = EventOrganizer(
            organizerVM.email, organizerVM.display_name, organizerVM.contact_id
        )
    else:
        organizer = EventOrganizer(userCalendar.email, userCalendar.summary, None)

    conferenceData = None

    conferenceDataVM = eventVM.conference_data
    if conferenceDataVM:
        conferenceData = ConferenceData(
            conferenceDataVM.conference_id,
            ConferenceSolution(
                conferenceDataVM.conference_solution.name,
                conferenceDataVM.conference_solution.key_type,
                conferenceDataVM.conference_solution.icon_uri,
            )
            if conferenceDataVM.conference_solution
            else None,
        )
        conferenceData.entry_points = [
            ConferenceEntryPoint(
                entryPointVM.entry_point_type,
                entryPointVM.uri,
                entryPointVM.label,
                entryPointVM.meeting_code,
                entryPointVM.password,
            )
            for entryPointVM in conferenceDataVM.entry_points
        ]

        if conferenceDataVM.create_request:
            conferenceData.create_request = ConferenceCreateRequest(
                conferenceDataVM.create_request.status,
                conferenceDataVM.create_request.request_id,
                conferenceDataVM.create_request.conference_solution_key_type,
            )

    if not eventDb:
        event = Event(
            googleId,
            eventVM.title,
            eventVM.description,
            eventVM.start,
            eventVM.end,
            eventVM.start_day,
            eventVM.end_day,
            eventVM.timezone,
            recurrences,
            eventVM.original_start,
            eventVM.original_start_day,
            eventVM.original_timezone,
            creator,
            organizer,
            eventVM.guests_can_modify,
            eventVM.guests_can_invite_others,
            eventVM.guests_can_see_other_guests,
            conferenceData,
            eventVM.location,
            visibility=eventVM.visibility,
            transparency=eventVM.transparency,
            status=eventVM.status,
            recurringEventId=eventVM.recurring_event_id,
            recurringEventCalendarId=userCalendar.id,
            overrideId=overrideId,
        )

        userCalendar.calendar.events.append(event)

        return event
    else:
        # Patch request. Updates only the fields that are set.
        eventDb.google_id = googleId or eventDb.google_id
        eventDb.title = eventVM.title or eventDb.title
        eventDb.description = eventVM.description or eventDb.description
        eventDb.start = eventVM.start or eventDb.start
        eventDb.end = eventVM.end or eventDb.end
        eventDb.start_day = eventVM.start_day or eventDb.start_day
        eventDb.end_day = eventVM.end_day or eventDb.end_day
        eventDb.time_zone = eventVM.timezone or eventDb.time_zone
        eventDb.recurring_event_id = eventVM.recurring_event_id or eventDb.recurring_event_id
        eventDb.recurring_event_calendar_id = userCalendar.id
        eventDb.recurrences = recurrences or eventDb.recurrences
        eventDb.guests_can_modify = eventVM.guests_can_modify or eventDb.guests_can_modify
        eventDb.guests_can_invite_others = (
            eventVM.guests_can_invite_others or eventDb.guests_can_invite_others
        )
        eventDb.guests_can_see_other_guests = (
            eventVM.guests_can_see_other_guests or eventDb.guests_can_see_other_guests
        )
        eventDb.conference_data = conferenceData or eventDb.conference_data
        eventDb.location = eventVM.location or eventDb.location

        if not eventDb.creator:
            eventDb.creator = creator

        eventDb.organizer = organizer
        eventDb.status = eventVM.status or eventDb.status
        eventDb.visibility = eventVM.visibility or eventDb.visibility
        eventDb.transparency = eventVM.transparency or eventDb.transparency

        return eventDb


def getRecurringEventId(
    baseEventId: Optional[str], startDate: datetime, isAllDay: bool
) -> Optional[str]:
    """Returns a composite ID for the recurring event, based on the original
    event ID and the start date.
    """
    if not baseEventId:
        return None

    dtStr = startDate.astimezone(ZoneInfo('UTC')).strftime(
        "%Y%m%d" if isAllDay else "%Y%m%dT%H%M%SZ"
    )
    return f'{baseEventId}_{dtStr}'
