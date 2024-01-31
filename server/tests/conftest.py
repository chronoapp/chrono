import uuid
import pytest

from sqlalchemy import select

from app.db.base_class import Base
from app.db.models import User, UserCalendar, UserAccount, CalendarProvider
from app.db.models.calendar import Calendar
from app.main import app

from app.api.utils.security import get_current_user
from app.api.utils.db import get_db
from app.db.repos.event_repo.event_repo import EventRepository
from app.db.repos.user_repo import UserRepository

from tests.test_session import scoped_session, engine
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def session():
    with scoped_session() as session:

        def getDbSession():
            return session

        app.dependency_overrides[get_db] = getDbSession

        yield session


@pytest.fixture
def test_client():
    yield TestClient(app)


@pytest.fixture
def eventRepo(session):
    yield EventRepository(session)


@pytest.fixture
def user(session):
    """Default user with a primary calendar."""

    user = User('user@chrono.so', 'Test User', None)
    userAccount = UserAccount(user.email, {}, CalendarProvider.Google, True)
    userAccount.user = user

    calendarId = uuid.uuid4()
    calendar = Calendar(calendarId, 'summary', 'description', 'America/Toronto', 'user@chrono.so')
    userCalendar = UserCalendar(
        calendarId, None, '#ffffff', '#000000', True, 'owner', True, False, []
    )
    userCalendar.calendar = calendar
    userCalendar.account = userAccount
    userCalendar.user = user
    session.add(userCalendar)
    session.add(user)
    session.commit()

    userRepo = UserRepository(session)
    user = userRepo.getUser(user.id)

    def override_get_user():
        return user

    app.dependency_overrides[get_current_user] = override_get_user

    yield user
