from asyncio import current_task

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as _AsyncSession, async_scoped_session

from app.core import config

engine = create_engine(
    config.SQLALCHEMY_DATABASE_URI,
    poolclass=NullPool,
    future=True,
)

async_engine = create_async_engine(
    config.SQLALCHEMY_DATABASE_URI.replace('postgresql://', 'postgresql+asyncpg://'),
    future=True,
)
async_session_factory = sessionmaker(async_engine, expire_on_commit=False, class_=_AsyncSession)

AsyncSession = async_scoped_session(async_session_factory, scopefunc=current_task)
