from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

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


@app.cli.command()
def update_events():
    username = 'winston'
    with scoped_session() as session:
        user = session.query(User).filter(User.username == username).first()

        with open('./scripts/events.json', 'r') as f:
            data = json.loads(f.read())

        newEvents = 0
        for d in data:
            google_id = d['id']
            summary = d['summary']
            description = d['description']
            start = datetime.fromisoformat(d['start'])
            end = datetime.fromisoformat(d['end'])
            delta = end - start
            minutes = delta.seconds / 60

            existingEvent = user.events.filter(Event.g_id == google_id).first()

            if not existingEvent:
                event = Event(google_id, summary, description, start, end)
                user.events.append(event)
                newEvents += 1

        logging.info(f'Added {newEvents} events.')


@app.cli.command()
def save_classifier():
    import numpy as np
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import CountVectorizer
    from sklearn.svm import LinearSVC
    from sklearn.feature_extraction.text import TfidfTransformer
    from sklearn.multiclass import OneVsRestClassifier
    from sklearn.preprocessing import MultiLabelBinarizer

    username = 'winston'
    user = db.session.query(User).filter(User.username == username).first()
    labelledEvents = user.events.filter(Event.labels.any()).all()

    eventTitles = np.array([e.title for e in labelledEvents])
    eventLabels = np.array([[l.title for l in e.labels] for e in labelledEvents])

    mlb = MultiLabelBinarizer()
    eventLabelsBin = mlb.fit_transform(eventLabels)

    # Classify with Linear SVC
    classifier = Pipeline([
        ('vectorizer', CountVectorizer(ngram_range=(1, 3))),
        ('tfidf', TfidfTransformer()),
        ('clf', OneVsRestClassifier(LinearSVC(multi_class="ovr")))])

    classifier.fit(eventTitles, eventLabelsBin)

    pathlib.Path('/var/lib/model_data').mkdir(parents=True, exist_ok=True)
    classifierPath = user.getClassifierPath()
    with open(classifierPath, 'wb') as f:
        data = {
            'binarizer': mlb,
            'classifier': classifier
        }
        pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)


@app.cli.command()
def classify():
    from sklearn.preprocessing import MultiLabelBinarizer
    from sqlalchemy import and_

    username = 'winston'
    user = db.session.query(User).filter(User.username == username).first()

    with open(user.getClassifierPath(), 'rb') as f:
        data = pickle.load(f)
        classifier = data['classifier']
        mlb = data['binarizer']

    unlabelledEvents = user.events.filter(and_(~Event.labels.any(), Event.title != None))
    eventTitles = [e.title for e in unlabelledEvents]
    predicted = mlb.inverse_transform(classifier.predict(eventTitles))

    newLabelCount = 0
    for idx, event in enumerate(unlabelledEvents):
        labelTitles = predicted[idx]
        if labelTitles:
            labels = []
            for labelTitle in labelTitles:
                label = db.session.query(Label).filter_by(title=labelTitle).first()
                if label:
                    labels.append(label)
                else:
                    logging.error(f'label not found {labelTitle}')

            event.labels = labels
            newLabelCount += len(labels)

    db.session.commit()
    logging.info(f'Added {newLabelCount} labels.')
