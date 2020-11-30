import pytest

from fastapi.testclient import TestClient

from tests.test_session import scoped_session, engine, TestingSessionLocal
from app.db.base_class import Base
from app.db.models import User
from app.main import app

from app.api.utils.security import get_current_user
from app.api.utils.db import get_db


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


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
def test_user():
    with scoped_session() as session:
        user = User('test@example.com', 'Test User', None)
        session.add(user)
        session.commit()

        def override_get_user():
            return user

        app.dependency_overrides[get_current_user] = override_get_user

        yield user
