from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

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
async_session_maker = sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)
