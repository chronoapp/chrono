from dateutil.rrule import rrule, rruleset, rrulestr
from zoneinfo import ZoneInfo
from app.api.endpoints.labels import LabelInDbVM
from datetime import datetime
from app.db.models.conference_data import (
    CommunicationMethod,
    ConferenceCreateStatus,
    ConferenceKeyType,
    ChronoConferenceType,
)
from app.db.models.event import EventStatus, Transparency, Visibility
from app.db.models.event_participant import ResponseStatus
from app.db.models.reminder import ReminderMethod


from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core.core_schema import FieldValidationInfo


import uuid
from typing import List, Optional, Union


class EventParticipantVM(BaseModel):
    """Either one of email or contact ID is required."""

    model_config = ConfigDict(from_attributes=True)

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


class EntryPointBaseVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entry_point_type: CommunicationMethod
    uri: str
    label: str | None = None
    meeting_code: str | None = None
    password: str | None = None


class CreateConferenceRequestVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: str = uuid.uuid4().hex
    status: ConferenceCreateStatus = ConferenceCreateStatus.PENDING
    conference_solution_key_type: ConferenceKeyType


class ConferenceSolutionVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    key_type: ConferenceKeyType
    icon_uri: str


class ConferenceDataBaseVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conference_id: str | None
    conference_solution: ConferenceSolutionVM | None

    # request to create conference
    create_request: CreateConferenceRequestVM | None

    # Linking EntryPoint
    entry_points: list[EntryPointBaseVM]

    type: ChronoConferenceType


class ReminderOverrideVM(BaseModel):
    """Viewmodel for reminders."""

    model_config = ConfigDict(from_attributes=True)

    method: ReminderMethod
    minutes: int


class EventBaseVM(BaseModel):
    """Viewmodel for events.
    We allow None for all fields, since we want to be able to PATCH some fields.

    TODO: If we have start_day and end_day, we don't need start and end.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

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
    visibility: Visibility = Visibility.DEFAULT
    transparency: Transparency = Transparency.OPAQUE
    use_default_reminders: bool | None = None
    reminders: list[ReminderOverrideVM] | None = None

    # Read only fields.
    original_start: Optional[datetime] = None
    original_start_day: Optional[str] = None
    original_timezone: Optional[str] = None

    extended_properties: dict | None = None
    updated_at: Optional[datetime] = None

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


class EventInDBVM(EventBaseVM):
    id: str


class GoogleEventInDBVM(EventInDBVM):
    google_id: Optional[str]


class ConferenceDataVM(ConferenceDataBaseVM):
    id: uuid.UUID


class EntryPointVM(EntryPointBaseVM):
    id: uuid.UUID


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
