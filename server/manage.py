import click
import logging

from app.db.session import scoped_session
from app.db.models import User, Label


@click.group()
def main():
    pass


DEFAULT_CATEGORIES = [
    'eat',
    'entertainment',
    'transportation',
    'work',
    'exercise',
    'social',
    'reading',
    'tourism',
    'chore',
]


@main.command()
@click.argument('userid')
def add_labels(userid):
    with scoped_session() as session:
        user = session.query(User).filter(User.id == userid).first()
        for l in user.labels:
            session.delete(l)

        for category in DEFAULT_CATEGORIES:
            label = Label(category, category.lower())
            user.labels.append(label)

        session.add(user)


@main.command()
@click.argument('userid')
def sync_cal(userid):
    from app.calendar.sync import syncGoogleCalendar
    syncGoogleCalendar(userid, 30)


@main.command()
@click.argument('userid')
def update_classifier(userid):
    from app.classify.classifier import updateClassifier
    updateClassifier(userid)


@main.command()
@click.argument('userid')
def auto_label(userid):
    from app.classify.classifier import classifyEvents
    classifyEvents(userid, startDaysAgo=30)


if __name__ == "__main__":
    main()
