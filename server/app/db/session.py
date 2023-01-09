from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session as _scoped_session
from sqlalchemy.pool import NullPool

from app.core import config

engine = create_engine(
    config.SQLALCHEMY_DATABASE_URI,
    poolclass=NullPool,
    future=True,
)

Session = sessionmaker(engine, expire_on_commit=False)


@contextmanager
def scoped_session():
    session = Session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
