import logging
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.db.session import scoped_session
from app.db.models import User, Event, LabelRule
from app.core.logger import logger


def syncGoogleCalendar(username: str, startDaysAgo: int = 30, endDaysAgo: int = 0):
    """Syncs events from google calendar.
    """
    with scoped_session() as session:
        user = session.query(User).filter(User.username == username).first()

        credentials = Credentials(**user.credentials.toDict())
        service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)
        eventList = getEvents(service, startDaysAgo, endDaysAgo)

        newEvents = 0
        updatedEvents = 0
        for event in eventList:
            google_id = event['id']
            summary = event['summary']
            description = event['description']
            start = datetime.fromisoformat(event['start'])
            end = datetime.fromisoformat(event['end'])

            event = user.events.filter(Event.g_id == google_id).first()
            if not event:
                # New event
                newEvents += 1
                event = Event(google_id, summary, description, start, end)
                user.events.append(event)
            else:
                # Update Event
                updatedEvents += 1
                event.title = summary
                event.description = description
                event.start_time = start
                event.end_time = end

            # Auto Labelling
            if event.title:
                labelRules = user.label_rules.filter(LabelRule.text.ilike(event.title))
                for rule in labelRules:
                    if not rule.label in event.labels:
                        event.labels.append(rule.label)

        logger.info(f'Updated {updatedEvents} events.')
        logger.info(f'Added {newEvents} events.')


def getEvents(service, startDaysAgo, endDaysAgo):
    calendarList = service.calendarList().list(maxResults=10).execute()
    eventList = []

    for calendar in calendarList.get('items'):
        calId = calendar.get('id')

        summary = calendar.get('summary')
        print(f'Sync Calendar: {summary}')
        prev = (datetime.utcnow() - timedelta(days=startDaysAgo)).isoformat() + 'Z'
        end = (datetime.utcnow() - timedelta(days=endDaysAgo)).isoformat() + 'Z'
        eventsResult = service.events().list(
            calendarId=calId,
            timeMax=end,
            timeMin=prev,
            maxResults=250,
            singleEvents=True,
            orderBy='startTime').execute()
        events = eventsResult.get('items', [])

        for event in events:
            data = {
                'id': event['id'],
                'start': event['start'].get('dateTime', event['start'].get('date')),
                'end': event['end'].get('dateTime', event['end'].get('date')),
                'summary': event.get('summary'),
                'description': event.get('description')
            }
            eventList.append(data)

    return eventList
