from flask.views import MethodView
from flask import jsonify, request

from api.session import scoped_session
from api.models import User, Label
from api import app

"""For operations on the Events.
"""


class EventAPI(MethodView):
    def get(self, eventId):
        userId = request.args.get('user_id')

        with scoped_session() as session:
            user = session.query(User).get(userId)
            event = user.events.filter_by(id=eventId).first()
            labels = event.labels.all()

            return jsonify({
                'labels': [l.toJson() for l in labels]
            })

    def put(self, eventId):
        userId = request.args.get('user_id')
        keys = request.json.get('keys')

        with scoped_session() as session:
            user = session.query(User).get(userId)
            event = user.events.filter_by(id=eventId).first()
            labels = user.labels.filter(Label.key.in_(keys)).all()
            event.labels = labels

            return jsonify({
                'labels': [l.toJson() for l in labels]
            })

    def delete(self, eventId):
        pass


eventApi = EventAPI.as_view('event-api')
# app.add_url_rule('/events/', defaults={'eventId': None}, view_func=eventApi, methods=['GET'])
app.add_url_rule('/events/<int:eventId>', view_func=eventApi, methods=['GET', 'PUT', 'DELETE',])
