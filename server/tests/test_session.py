from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

SQLALCHEMY_DATABASE_URI = "postgresql://{0}:{1}@{2}/{3}".format(
    'postgres', 'postgres', 'postgres_test', 'postgres'
)

engine = create_engine(SQLALCHEMY_DATABASE_URI, poolclass=NullPool, future=True)
test_session_maker = sessionmaker(engine, future=True)
