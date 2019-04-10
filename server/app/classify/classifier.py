import numpy as np
import pathlib
import pickle
from sqlalchemy import and_

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.svm import LinearSVC
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import MultiLabelBinarizer

from app.db.models import Event, User, Label
from app.db.session import scoped_session
from app.core.logger import logger


def updateClassifier(username: str):
    with scoped_session() as session:
        user = session.query(User).filter(User.username == username).first()
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


def classifyEvents(username: str):
    with scoped_session() as session:
        user = session.query(User).filter(User.username == username).first()

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
                    label = session.query(Label).filter_by(title=labelTitle).first()
                    if label:
                        labels.append(label)
                    else:
                        logger.error(f'label not found {labelTitle}')

                event.labels = labels
                newLabelCount += len(labels)

        logger.info(f'Added {newLabelCount} labels.')
