from sanic import response
from sanic.views import HTTPMethodView
from sqlalchemy import text

from . import sanicApp as app
from .db import scoped_session, engine
from .models import User, Label, Event


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
async def getHealthCheck(request):
    return response.json({'data': {'healthcheck': 'OK'}})


@app.route('/labels')
async def getLabels(request):
    return response.json({
        'labels': DEFAULT_CATEGORIES
    })


@app.route('/stats')
async def getUserStats(request):
    userId = request.args.get('user_id')
    daySeconds = 24 * 60 * 60
    weekSeconds = daySeconds * 7
    query = \
        "SELECT\
            sum(EXTRACT(EPOCH FROM (end_time - start_time))),\
            (date_trunc('seconds',\
                (start_time - timestamptz 'epoch') / :seconds) * :seconds + timestamptz 'epoch') as time_chunk\
        FROM event\
        WHERE event.user_id = :userId\
        GROUP BY time_chunk\
        ORDER BY time_chunk DESC"

    result = engine.execute(text(query), seconds=weekSeconds, userId=userId)
    names = []
    for row in result:
        print(row)

    with scoped_session() as session:
        user = session.query(User).get(userId)
        results = session.query(Event)
        return response.json({
        })


@app.route('/events')
async def getEvents(request):
    #TODO: use token
    userId = request.args.get('user_id')

    with scoped_session() as session:
        user = session.query(User).get(userId)
        # eventWithLabel = user.events.join(Event.labels)
        # print(eventWithLabel.count())
        events = [e.toJson() for e in user.events.all()]

        return response.json({
            'events': events
        })


class EventLabelView(HTTPMethodView):
    async def get(self, request, eventId):
        #TODO: use token
        userId = request.args.get('user_id')

        with scoped_session() as session:
            user = session.query(User).get(userId)
            event = user.events.get(eventId)
            labels = event.labels.all()

            return response.json({
                'labels': [l.toJson() for l in labels]
            })

app.add_route(EventLabelView.as_view(), '/events/<eventId>/labels')
