from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

import click
import json
import logging
import pickle
import pathlib
from typing import Any
from datetime import datetime

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
app.config.from_object('api.config.DevelopmentConfig')
CORS(app)
db: Any = SQLAlchemy(app)
Migrate(app, db)

# Attach views.
from api.views import *
from api.models import Event, User, Label
from api.session import scoped_session
from api.views import createUser


@app.cli.command()
@click.argument('username')
def init_user(username):
    createUser(username)


@app.cli.command()
def clear_user():
    username = 'winston'
    user = db.session.query(User).filter(User.username == username).first()
    for event in user.events.all():
        event.labels = []
    db.session.commit()


@app.cli.command()
@click.argument('username')
def sync_cal(username):
    from api.calendar.sync import syncGoogleCalendar
    syncGoogleCalendar(username)


@app.cli.command()
@click.argument('username')
def save_classifier(username):
    from api.classify import updateClassifier
    updateClassifier(username)


@app.cli.command()
@click.argument('username')
def classify(username):
    from api.classify import classifyEvents
    classifyEvents(username)


@app.cli.command()
def query():
    results = Event.search('1', "timecouncil")
    logging.info(results)
