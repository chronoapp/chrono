from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

SQLALCHEMY_DATABASE_URI = "postgresql://{0}:{1}@{2}/{3}".format('postgres', 'postgres',
                                                                'postgres_test', 'postgres')

engine = create_engine(SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
TestingSessionLocal = sessionmaker(bind=engine)


@contextmanager
def scoped_session():
    session = TestingSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
