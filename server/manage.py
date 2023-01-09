from datetime import datetime
import click
import asyncio
from functools import wraps


from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.repos.calendar_repo import CalendarRepo
from app.api.repos.event_repo import EventRepository
from app.api.repos.user_repo import UserRepository
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


def click_coroutine(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@main.command()
@click.argument('userid')
def add_labels(userid):
    with scoped_session() as session:
        stmt = select(User).where(User.id == int(userid))
        result = session.execute(stmt)
        user = result.scalar()

        for l in user.labels:
            session.delete(l)

        for category in DEFAULT_CATEGORIES:
            label = Label(category, category.lower())
            user.labels.append(label)

        session.add(user)


@main.command()
@click.argument('userid', type=click.INT)
@click.option('--full', is_flag=True, default=False)
def sync_cal_all(userid: int, full: bool):
    from app.sync.google.tasks import syncAllCalendarsTask

    syncAllCalendarsTask.send(userid, fullSync=full)


@main.command()
@click.argument('userId', type=click.INT)
@click.argument('cal', type=click.STRING)
@click.option('--full', is_flag=True, default=False)
def sync_cal_id(userid: int, cal: str, full: bool):
    from app.sync.google.calendar import syncCalendarEvents
    from sqlalchemy.orm import selectinload

    with scoped_session() as session:
        user = (
            session.execute(
                select(User).where(User.id == userid).options(selectinload(User.credentials))
            )
        ).scalar()

        calendar = next((c for c in user.calendars if cal.lower() in c.summary.lower()), None)
        if not calendar:
            print(f'Calendar {cal} not found')
            return

        print(f'Syncing {calendar.summary}..')
        syncCalendarEvents(calendar, session, fullSync=full)


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


@main.command()
def script():
    """Insert scripts here"""
    pass


if __name__ == "__main__":
    main()
