from asyncio import current_task

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession as _AsyncSession,
    async_scoped_session,
)

from app.core import config

engine = create_engine(
    config.SQLALCHEMY_DATABASE_URI,
    poolclass=NullPool,
    future=True,
)

# NullPool prevents the Engine from using any connection more than once.
# https://docs.sqlalchemy.org/en/14/orm/extensions/asyncio.html#using-multiple-asyncio-event-loops
async_engine = create_async_engine(
    config.SQLALCHEMY_DATABASE_URI.replace('postgresql://', 'postgresql+asyncpg://'),
    poolclass=NullPool,
    future=True,
)
async_session_factory = sessionmaker(async_engine, expire_on_commit=False, class_=_AsyncSession)

AsyncSession = async_scoped_session(async_session_factory, scopefunc=current_task)
