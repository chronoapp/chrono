from flask import jsonify, request
from flask.views import MethodView
from sqlalchemy import text, func, desc

from api import app
from api.session import scoped_session, engine
from api.models import User, Label, Event

from enum import Enum

from .events import *


class TimeSpan(Enum):
    DAILY = 1
    DAYS_14 = 14
    DAYS_30 = 30


DEFAULT_CATEGORIES = ['eat', 'entertainment', 'transportation', 'work', 'exercise',
              'social', 'reading', 'education', 'tourism', 'chore', 'event', 'sleep']


def createUser(username):
    with scoped_session() as session:    
        user = User(username)

        for category in DEFAULT_CATEGORIES:
            label = Label(category)
            user.labels.append(label)

        session.add(user)


@app.route('/')
def getHealthCheck():
    return jsonify({'data': {'healthcheck': 'OK'}})


@app.route('/labels')
def getLabels():
    return jsonify({
        'labels': DEFAULT_CATEGORIES
    })


@app.route('/stats')
def getUserStats():
    userId = request.args.get('user_id')
    daySeconds = 24 * 60 * 60
    weekSeconds = daySeconds * 7
    query = \
        "SELECT\
            sum(EXTRACT(EPOCH FROM (end_time - start_time))),\
            (date_trunc('seconds',\
                (start_time - timestamptz 'epoch') / :seconds) * :seconds + timestamptz 'epoch') as time_chunk\
        FROM (\
            SELECT\
                event.start_time,\
                event.end_time as end_time,\
                label.key as label\
            FROM event\
            INNER JOIN event_label ON event_label.event_id = event.id\
            INNER JOIN label ON label.id = event_label.label_id\
            WHERE label.key = :label\
            AND event.user_id = :userId\
        ) as sq\
        GROUP BY time_chunk\
        ORDER BY time_chunk ASC"

    result = engine.execute(text(query),
        seconds=weekSeconds,
        userId=userId,
        label='work')

    labels = []
    durations = []
    for row in result:
        duration, date = row
        labels.append(date.strftime('%Y-%m-%d'))
        durations.append(duration / 60.0 / 60.0)

    with scoped_session() as session:
        user = session.query(User).get(userId)
        results = session.query(Event)
        return jsonify({
            'labels': labels,
            'values': durations
        })


@app.route('/events')
def getEvents():
    # TODO: use token
    userId = request.args.get('user_id')

    with scoped_session() as session:
        user = session.query(User).get(userId)
        events = [
            e.toJson() for e in user.events.order_by(desc(Event.end_time)).limit(50)
        ]

        return jsonify({
            'events': events
        })


@app.route('/unlabelled_events')
def getUnlabelledEvents():
    """Get unique events which have not been labelled.
    """
    userId = request.args.get('user_id')
    with scoped_session() as session:
        user = session.query(User).get(userId)
        uniqueEventTitles = set()
        for event in user.events.all():
            uniqueEventTitles.add(event.title)

        return jsonify({
            'events': list(uniqueEventTitles)
        })


@app.route('/events/<eventId>/add_label', methods=['POST'])
def addEventLabel(request, eventId):
    userId = request.args.get('user_id')
    labelKey = request.json.get('key')

    with scoped_session() as session:
        user = session.query(User).get(userId)
        event = user.events.filter_by(id=eventId).first()
        label = user.labels.filter_by(key=labelKey).first()
        event.labels.append(label)

        # # Add to all events with the same title
        # otherEvents = user.events.filter_by(title=event.title).all()
        # for event in otherEvents:
        #     event.labels.append(label)

        return jsonify({
            'labels': [l.toJson() for l in event.labels]
        })
