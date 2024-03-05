import uuid
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from typing import Any

from app.core.logger import logger
from app.db.models import Event, ReminderMethod
from app.db.models.conference_data import (
    ChronoConferenceType,
    CommunicationMethod,
    ConferenceCreateStatus,
    ConferenceKeyType,
)
from app.db.models.event import Transparency, Visibility
from app.db.repos.event_repo.view_models import (
    ConferenceDataBaseVM,
    ConferenceSolutionVM,
    CreateConferenceRequestVM,
    EntryPointBaseVM,
    EventParticipantVM,
    ReminderOverrideVM,
)

from .view_models import ConferenceData, GoogleCalendarEvent, GoogleEventVM, ExtendedProperties

"""Transforms Viewmodels from Google to Chrono data models and vice versa.
"""


def chronoToGoogleEvent(event: Event, timeZone: str):
    """Converts Chrono event to Google event.

    TODO: Use the Pydantic Model for validation.
    """
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

    # Either conferenceSolution and at least one entryPoint, or createRequest is required.
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

        extendedProperties = event.extended_properties or {}
        eventBody['extendedProperties'] = extendedProperties
    else:
        eventBody['conferenceData'] = None
        eventBody['extendedProperties'] = event.extended_properties or {}

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


def googleEventToEventVM(calendarId: uuid.UUID, eventItem: dict[str, Any]) -> GoogleEventVM:
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

    conferenceDataVM = _conferenceDataToVM(
        googleEvent.conferenceData, googleEvent.extendedProperties
    )
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
        extended_properties=(
            googleEvent.extendedProperties.model_dump() if googleEvent.extendedProperties else None
        ),
        updated_at=googleEvent.updated,
    )

    return eventVM


def convertStatus(status: str):
    if status == 'tentative':
        return 'tentative'
    elif status == 'cancelled':
        return 'deleted'
    else:
        return 'active'


def _conferenceDataToVM(
    conferenceData: ConferenceData | None, extendedProperties: ExtendedProperties | None
) -> ConferenceDataBaseVM | None:
    """Parses conference data from Google to Chrono's view model."""
    if not conferenceData:
        return None

    conferenceDataVM = None

    conferenceType = ChronoConferenceType.Google
    if extendedProperties and extendedProperties.private is not None:
        conferenceDataProperty = extendedProperties.private.get('chrono_conference')
        if conferenceDataProperty:
            try:
                conferenceDataPropertyDict = json.loads(conferenceDataProperty)
                if (
                    conferenceDataPropertyDict['type'] == ChronoConferenceType.Zoom.value
                    and conferenceDataPropertyDict['id'] == conferenceData.conferenceId
                ):
                    conferenceType = ChronoConferenceType.Zoom

            except json.JSONDecodeError:
                # In case the property has been tampered with.
                logger.warning(
                    f'Failed to decode conference data property {conferenceDataProperty}'
                )

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
        type=conferenceType,
    )

    return conferenceDataVM


def _convertToLocalTime(dateTime: datetime, timeZone: str | None):
    if not timeZone:
        return dateTime

    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware
