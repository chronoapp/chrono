import pytest

from fastapi.testclient import TestClient

from tests.test_session import test_session_maker, engine
from app.db.base_class import Base
from app.db.models import User, Calendar
from app.main import app

from app.api.utils.security import get_current_user
from app.api.utils.db import get_db


def override_get_db():
    with test_session_maker.begin() as session:
        yield session


@pytest.fixture(autouse=True)
def run_before_and_after_tests():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_client():
    yield TestClient(app)


@pytest.fixture
def userSession():
    """Initializes the test user with one primary calendar.
    Returns fixture with tuple of (user, session)
    """
    with test_session_maker() as session:
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
        session.commit()

        def override_get_user():
            return user

        def getDbSession():
            return session

        app.dependency_overrides[get_db] = getDbSession
        app.dependency_overrides[get_current_user] = override_get_user

        yield user, session
