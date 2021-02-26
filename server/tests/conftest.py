import pytest
from httpx import AsyncClient

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool

from app.db.base_class import Base
from app.db.models import User, Calendar
from app.main import app

from app.api.utils.security import get_current_user
from app.api.utils.db import get_db


SQLALCHEMY_DATABASE_URI = "postgresql+asyncpg://{0}:{1}@{2}/{3}".format(
    'postgres', 'postgres', 'postgres_test', 'postgres'
)


@pytest.fixture(scope="session")
def engine():
    async_engine = create_async_engine(
        SQLALCHEMY_DATABASE_URI,
        poolclass=NullPool,
        future=True,
    )

    yield async_engine

    async_engine.sync_engine.dispose()


@pytest.fixture()
async def create(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://localhost") as ac:
        yield ac


@pytest.fixture
async def session(engine, create):
    async with AsyncSession(engine, expire_on_commit=False) as session:

        def getDbSession():
            return session

        app.dependency_overrides[get_db] = getDbSession

        yield session


@pytest.fixture
async def user(session):
    """Default user with a primary calendar."""
    user = User('test@example.com', 'Test User', None)
    calendar = Calendar(
        'default',
        'America/Toronto',
        'Default Calendar',
        'description',
        '#ffffff',
        '#000000',
        True,
        'owner',
        True,
        False,
    )
    user.calendars.append(calendar)
    session.add(user)
    await session.commit()

    user = (await session.execute(select(User).where(User.id == user.id))).scalar()

    def override_get_user():
        return user

    app.dependency_overrides[get_current_user] = override_get_user

    yield user
