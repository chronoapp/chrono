from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core import config

engine = create_engine(config.SQLALCHEMY_DATABASE_URI, poolclass=NullPool, future=True)
session_maker = sessionmaker(engine, future=True)
