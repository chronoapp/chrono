from datetime import datetime
from pydantic import BaseModel

from typing import Literal

from app.db.repos.event_repo.view_models import EventBaseVM


"""
Defines Pydantic models for Google Calendar API data.
"""

ResponseStatus = Literal['needsAction', 'accepted', 'declined', 'tentative']


class Person(BaseModel):
    id: str | None = None
    email: str | None = None
    displayName: str | None = None
    self: bool = False


class DateTimeInfo(BaseModel):
    date: str | None = None
    dateTime: str | None = None
    timeZone: str | None = None


class Attendee(BaseModel):
    id: str | None = None
    email: str | None = None
    displayName: str | None = None
    organizer: bool = False
    self: bool = False
    resource: bool = False
    optional: bool = False
    responseStatus: ResponseStatus = 'needsAction'
    comment: str | None = None
    additionalGuests: int = 0


class ExtendedProperties(BaseModel):
    private: dict[str, str] | None = None
    shared: dict[str, str] | None = None


class EntryPoint(BaseModel):
    id: str | None = None
    entryPointType: str
    uri: str | None = None
    label: str | None = None
    pin: str | None = None
    accessCode: str | None = None
    meetingCode: str | None = None
    passcode: str | None = None
    password: str | None = None


class ConferenceSolutionKey(BaseModel):
    type: str


class ConferenceSolution(BaseModel):
    key: ConferenceSolutionKey
    name: str
    iconUri: str


class CreateRequestStatus(BaseModel):
    statusCode: Literal['pending', 'success', 'failure']


class CreateRequest(BaseModel):
    requestId: str
    conferenceSolutionKey: ConferenceSolutionKey
    status: CreateRequestStatus


class ConferenceData(BaseModel):
    createRequest: CreateRequest | None = None
    entryPoints: list[EntryPoint] = []
    conferenceSolution: ConferenceSolution | None = None
    conferenceId: str
    signature: str | None = None
    notes: str | None = None


class ReminderOverride(BaseModel):
    method: Literal['popup', 'email']
    minutes: int


class Reminder(BaseModel):
    useDefault: bool
    overrides: list[ReminderOverride] = []


class Source(BaseModel):
    url: str
    title: str


class Attachment(BaseModel):
    fileUrl: str
    title: str
    mimeType: str
    iconLink: str
    fileId: str


class WorkingLocation(BaseModel):
    type: str
    homeOffice: str  # This is specified as (value) so type is assumed
    customLocation: dict[str, str] | None
    officeLocation: dict[str, str] | None


class GoogleCalendarEvent(BaseModel):
    """The event that we receive from the Google Calendar API."""

    id: str
    kind: str | None = None
    etag: str | None = None
    status: str = 'confirmed'
    htmlLink: str | None = None
    created: datetime
    updated: datetime
    summary: str | None = None
    description: str | None = None
    location: str | None = None
    colorId: str | None = None
    creator: Person | None = None
    organizer: Person | None = None
    start: DateTimeInfo
    end: DateTimeInfo
    endTimeUnspecified: bool = False
    recurrence: list[str] | None = None
    recurringEventId: str | None = None
    originalStartTime: DateTimeInfo | None = None
    transparency: Literal['opaque', 'transparent'] = 'opaque'
    visibility: Literal['default', 'public', 'private', 'confidential'] = 'default'
    iCalUID: str | None = None
    attendees: list[Attendee] = []
    attendeesOmitted: bool = False
    extendedProperties: ExtendedProperties | None = None
    conferenceData: ConferenceData | None = None
    anyoneCanAddSelf: bool = False
    guestsCanInviteOthers: bool = True
    guestsCanModify: bool = False
    guestsCanSeeOtherGuests: bool = True
    privateCopy: bool | None = None
    locked: bool | None = None
    reminders: Reminder | None = None
    source: Source | None = None
    workingLocationProperties: WorkingLocation | None = None
    attachments: list[Attachment] = []
    eventType: str | None = None


class GoogleEventVM(EventBaseVM):
    """Internal representation of a Google Calendar event."""

    google_id: str | None
    recurring_event_g_id: str | None
    updated_at: datetime
