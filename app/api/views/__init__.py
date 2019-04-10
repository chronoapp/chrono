from os.path import dirname, basename, isfile
import glob
from enum import Enum

from flask import jsonify, request
from sqlalchemy import text, desc

from api import app
from api.session import scoped_session, engine
from api.models import User, Label, Event
from api.utils.middleware import authorized

# Include all in this directory.
modules = glob.glob(dirname(__file__) + "/*.py")
__all__ = [basename(f)[:-3] for f in modules if isfile(f) and not f.endswith('__init__.py')]


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
@authorized
def getLabels():
    user = request.environ.get('user')

    return jsonify({
        'labels': [l.key for l in user.labels.all()]
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
