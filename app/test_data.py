
from api.models import User, Event, Label
from api.db import scoped_session
import json
from datetime import datetime

categories = ['eat', 'entertainment', 'transportation', 'work', 'exercise',
              'social', 'reading', 'education', 'tourism', 'chore', 'event', 'sleep']

with scoped_session() as session:
    user = session.query(User)\
        .filter(User.username=='winston').first()

    # with open('./notebooks/events_60days.json', 'r') as f:
    #     data = json.loads(f.read())

    # for d in data:
    #     google_id = d['id']
    #     summary = d['summary']
    #     description = d['description']
    #     start = datetime.fromisoformat(d['start'])
    #     end = datetime.fromisoformat(d['end'])
    #     delta = end - start
    #     minutes = delta.seconds / 60
    #     event = Event(google_id, summary, description, start, end)
    #     user.events.append(event)
    
    # session.add(user)
