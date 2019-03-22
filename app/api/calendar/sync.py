import logging
import json
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from api.session import scoped_session
from api.models import User, Event


def syncGoogleCalendar(username):
    """Syncs events from google calendar.
    """
    with scoped_session() as session:
        user = session.query(User).filter(User.username == username).first()

        credentials = Credentials(**user.credentials.toDict())
        service = build('calendar', 'v3', credentials=credentials, cache_discovery=False)
        eventList = getEvents(service, 30, 0)

        newEvents = 0
        for event in eventList:
            google_id = event['id']
            summary = event['summary']
            description = event['description']
            start = datetime.fromisoformat(event['start'])
            end = datetime.fromisoformat(event['end'])

            existingEvent = user.events.filter(Event.g_id == google_id).first()
            if not existingEvent:
                event = Event(google_id, summary, description, start, end)
                user.events.append(event)
                newEvents += 1

        logging.info(f'Added {newEvents} events.')


def getEvents(service, startDaysAgo, endDaysAgo):
    calendarList = service.calendarList().list(maxResults=10).execute()
    calendarIds = [cal.get('id') for cal in calendarList.get('items')]

    eventList = []

    for calId in calendarIds:
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
