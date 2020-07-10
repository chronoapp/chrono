import logging
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.db.session import scoped_session
from app.db.models import User, Event, LabelRule, Calendar
from app.core.logger import logger


def syncGoogleCalendar(userId: int, startDaysAgo: int = 30, endDaysAgo: int = 0):
    """Syncs events from google calendar.
    """
    with scoped_session() as session:
        user = session.query(User).filter(User.id == userId).first()

        credentials = Credentials(**user.credentials.toDict())
        service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)
        calendarList = service.calendarList().list().execute()

        newEvents = 0
        updatedEvents = 0
        for calendar in calendarList.get('items'):
            calId = calendar.get('id')

            prev = (datetime.utcnow() - timedelta(days=startDaysAgo)).isoformat() + 'Z'
            end = (datetime.utcnow() - timedelta(days=endDaysAgo)).isoformat() + 'Z'

            print(f'Update Calendar: {calId}')

            userCalendar = user.calendars.filter_by(id=calId).first()
            if userCalendar:
                userCalendar.timezone = calendar.get('timeZone')
                userCalendar.summary = calendar.get('summary')
                userCalendar.description = calendar.get('description')
                userCalendar.background_color = calendar.get('backgroundColor')
                userCalendar.foreground_color = calendar.get('foregroundColor')
                userCalendar.selected = calendar.get('selected')
                userCalendar.access_role = calendar.get('accessRole')
                userCalendar.primary = calendar.get('primary')
                userCalendar.deleted = calendar.get('deleted')
            else:
                userCalendar = Calendar(calId, calendar.get('timeZone'), calendar.get('summary'),
                                        calendar.get('description'),
                                        calendar.get('backgroundColor'),
                                        calendar.get('foregroundColor'), calendar.get('selected'),
                                        calendar.get('accessRole'), calendar.get('primary'),
                                        calendar.get('deleted'))
                user.calendars.append(userCalendar)

            eventsResult = service.events().list(calendarId=calId,
                                                 timeMax=end,
                                                 timeMin=prev,
                                                 maxResults=250,
                                                 singleEvents=True,
                                                 orderBy='startTime').execute()
            events = eventsResult.get('items', [])

            for event in events:
                eventId = event['id']
                eventStart = event['start'].get('dateTime', event['start'].get('date'))
                eventEnd = event['end'].get('dateTime', event['end'].get('date'))
                eventSummary = event.get('summary')
                eventDescription = event.get('description')

                event = user.events.filter(Event.g_id == eventId).first()
                if not event:
                    # New event
                    newEvents += 1
                    event = Event(eventId, eventSummary, eventDescription, eventStart, eventEnd,
                                  userCalendar.id)
                    user.events.append(event)
                else:
                    # Update Event
                    updatedEvents += 1
                    event.title = eventSummary
                    event.description = eventDescription
                    event.start_time = eventStart
                    event.end_time = eventEnd

                # Auto Labelling
                if event.title:
                    labelRules = user.label_rules.filter(LabelRule.text.ilike(event.title))
                    for rule in labelRules:
                        if not rule.label in event.labels:
                            event.labels.append(rule.label)

        logger.info(f'Updated {updatedEvents} events.')
        logger.info(f'Added {newEvents} events.')
