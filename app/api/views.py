from sanic import response

from . import sanicApp as app
from .db import scoped_session
from .models import User, Label


DEFAULT_CATEGORIES = ['eat', 'entertainment', 'transportation', 'work', 'exercise',
              'social', 'reading', 'education', 'tourism', 'chore', 'event', 'sleep']


@app.route('/')
async def getHealthCheck(request):
    return response.json({'data': {'healthcheck': 'OK'}})


@app.route('/users/<userId>/stats')
async def getUserStats(request, userId):
    # TODO: Gets summary of time trends
    return response.json({})


def createUser(username):
    with scoped_session() as session:    
        user = User(username)

        for category in DEFAULT_CATEGORIES:
            label = Label(category)
            user.labels.append(label)

        session.add(user)
