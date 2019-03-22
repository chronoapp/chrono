import json
import logging

from sqlalchemy import desc
from flask.views import MethodView
from flask import jsonify, request

from api.session import scoped_session
from api.models import User, Label, Event
from api.utils.middleware import authorized
from api import app, db

"""For operations on the Events.
"""


class EventAPI(MethodView):

    @authorized
    def get(self, eventId):
        logging.info('EventAPI::get')

        if eventId:
            user = request.environ.get('user')
            event = user.events.filter_by(id=eventId).first()

            return jsonify({
                'event': event.toJson()
            })

        else:
            user = request.environ.get('user')
            userEvents = user.events.order_by(desc(Event.end_time)).limit(150)

            return jsonify({
                'events': [e.toJson() for e in userEvents]
            })

    @authorized
    def put(self, eventId):
        user = request.environ.get('user')
        keys = json.loads(request.data).get('keys')

        event = user.events.filter_by(id=eventId).first()
        labels = user.labels.filter(Label.key.in_(keys)).all()
        event.labels = labels
        db.session.commit()

        return jsonify({
            'event': event.toJson()
        })

    @authorized
    def delete(self, eventId):
        pass


@app.route('/events/<eventId>/add_label', methods=['POST'])
@authorized
def addEventLabel(eventId):
    user = request.environ.get('user')
    labelKey = json.loads(request.data).get('key')

    event = user.events.filter_by(id=eventId).first()
    label = user.labels.filter_by(key=labelKey).first()
    event.labels.append(label)
    db.session.commit()

    # # Add to all events with the same title
    # otherEvents = user.events.filter_by(title=event.title).all()
    # for event in otherEvents:
    #     event.labels.append(label)

    return jsonify({
        'labels': [l.toJson() for l in event.labels]
    })


eventApi = EventAPI.as_view('event-api')
app.add_url_rule('/events/', defaults={'eventId': None}, view_func=eventApi, methods=['GET'])
app.add_url_rule('/events/<int:eventId>', view_func=eventApi, methods=['GET', 'PUT', 'DELETE'])
