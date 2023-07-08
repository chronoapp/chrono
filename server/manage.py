import click
import asyncio
from functools import wraps
from sqlalchemy import select
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
@click.argument('email', type=click.STRING)
@click.option('--full', is_flag=True, default=False)
def sync_cal_all(email: str, full: bool):
    from app.sync.google.tasks import syncAllCalendarsTask

    with scoped_session() as session:
        userRepo = UserRepository(session)
        user = userRepo.getUserByEmail(email)
        if not user:
            print(f'User {email} not found')
            return

        syncAllCalendarsTask.send(user.id, fullSync=full)


@main.command()
@click.argument('email', type=click.STRING)
@click.argument('cal', type=click.STRING)
@click.option('--full', is_flag=True, default=False)
def sync_cal(email: str, cal: str, full: bool):
    from app.sync.google.calendar import syncCalendarEvents
    from sqlalchemy.orm import selectinload

    with scoped_session() as session:
        userRepo = UserRepository(session)
        user = userRepo.getUserByEmail(email)
        if not user:
            print(f'User {email} not found')
            return

        calendar = next((c for c in user.calendars if cal.lower() in c.summary.lower()), None)
        if not calendar:
            print(f'Calendar {cal} not found')
            return

        print(f'Syncing {calendar.summary}..')
        syncCalendarEvents(calendar, session, fullSync=full)


@main.command()
def script():
    """Insert scripts here"""
    pass


if __name__ == "__main__":
    main()
