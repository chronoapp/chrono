import click
import logging
import asyncio
from functools import wraps


from sqlalchemy import select
from app.db.session import AsyncSession
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
    async def run():
        async with AsyncSession() as session:
            stmt = select(User).where(User.id == int(userid))
            result = await session.execute(stmt)
            user = result.scalar()

            for l in user.labels:
                session.delete(l)

            for category in DEFAULT_CATEGORIES:
                label = Label(category, category.lower())
                user.labels.append(label)

            session.add(user)

    asyncio.run(run())


@main.command()
@click.argument('userid', type=click.INT)
@click_coroutine
async def sync_cal(userid: int):
    from app.calendar.google import syncAllEvents

    await syncAllEvents(userid, fullSync=False)


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
