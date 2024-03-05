from uuid import uuid4

from app.sync.google.converter import googleEventToEventVM

googleEvent = {
    "kind": "calendar#event",
    "etag": "\"<e-tag>\"",
    "id": "<event-id>",
    "status": "confirmed",
    "htmlLink": "https://www.google.com/calendar/event?eid=<event_id>",
    "created": "2023-08-14T19:12:59.000Z",
    "updated": "2023-08-14T19:13:01.699Z",
    "summary": "<event-title>",
    "creator": {"email": "test@rechrono.com", "self": True},
    "organizer": {"email": "test@rechrono.com", "self": True},
    "start": {"dateTime": "2023-08-16T07:30:00-04:00", "timeZone": "America/Toronto"},
    "end": {"dateTime": "2023-08-16T09:00:00-04:00", "timeZone": "America/Toronto"},
    "iCalUID": "<event-id>@google.com",
    "sequence": 0,
    "hangoutLink": "https://meet.google.com/<google-meet-id>",
    "conferenceData": {
        "createRequest": {
            "requestId": "cllb95m1t299q496ao2jbqwu3",
            "conferenceSolutionKey": {"type": "hangoutsMeet"},
            "status": {"statusCode": "success"},
        },
        "entryPoints": [
            {
                "entryPointType": "video",
                "uri": "https://meet.google.com/<google-meet-id>",
                "label": "meet.google.com/<google-meet-id>",
            }
        ],
        "conferenceSolution": {
            "key": {"type": "hangoutsMeet"},
            "name": "Google Meet",
            "iconUri": "https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png",
        },
        "conferenceId": "<google-meet-id>",
    },
    "guestsCanModify": True,
    "reminders": {"useDefault": True},
    "eventType": "default",
    "extendedProperties": {
        "private": {"chrono_conference_type": "google", 'another-field': 'another-value'}
    },
}


def test_converter_googleEventToEventVM():
    eventVM = googleEventToEventVM(uuid4().hex, googleEvent)

    assert eventVM.title == "<event-title>"
    assert eventVM.extended_properties['private']["chrono_conference_type"] == "google"
    assert eventVM.extended_properties['private']['another-field'] == 'another-value'

    entryPoint = eventVM.conference_data.entry_points[0]

    assert entryPoint.uri == "https://meet.google.com/<google-meet-id>"
    assert entryPoint.label == "meet.google.com/<google-meet-id>"
    assert eventVM.conference_data.conference_solution.name == "Google Meet"
