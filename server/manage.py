import click
import logging

from app.db.session import scoped_session
from app.db.models import User, Label


@click.group()
def main():
    pass


DEFAULT_CATEGORIES = ['eat', 'entertainment', 'transportation', 'work', 'exercise',
              'social', 'reading', 'education', 'tourism', 'chore', 'event', 'sleep']


@main.command()
@click.argument('username')
def add_labels(username):
    with scoped_session() as session:
        user = session.query(User).filter(User.username == username).first()
        for l in user.labels:
            session.delete(l)

        for category in DEFAULT_CATEGORIES:
            label = Label(category, category.lower())
            user.labels.append(label)

        session.add(user)


@main.command()
@click.argument('username')
def sync_cal(username):
    from app.calendar.sync import syncGoogleCalendar
    syncGoogleCalendar(username)


if __name__ == "__main__":
    main()