""" This module exports the database engine.
Notes:
     Using the scoped_session contextmanager is
     best practice to ensure the session gets closed
     and reduces noise in code by not having to manually
     commit or rollback the db if a exception occurs.
"""
import os, warnings, logging
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

engine = create_engine(os.environ['DATABASE_URL'], poolclass=NullPool)
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# TODO: connect to pgbouncer
Session = sessionmaker(bind=engine)

@contextmanager
def scoped_session():
    session = Session()
    try:
        yield session
        session.commit()
    except:
        session.rollback()
        raise
    finally:
        session.close()
