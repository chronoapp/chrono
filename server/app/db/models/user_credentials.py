from sqlalchemy import Column, Integer, ForeignKey, Enum, String
from sqlalchemy.dialects.postgresql import ENUM as pgEnum, JSONB
from enum import Enum

from app.db.base_class import Base


class ProviderType(Enum):
    Google = 'google'
    Microsoft = 'microsoft'


class UserCredential(Base):
    __tablename__ = 'user_credentials'
    user_id = Column(Integer, ForeignKey('user.id'), primary_key=True)
    provider = Column(
        String(30),
        unique=False,
        nullable=False,
        primary_key=True,
    )

    token_data = Column(JSONB, nullable=False)

    def __init__(self, tokenData: dict, provider: ProviderType) -> None:
        self.token_data = tokenData
        self.provider = provider.value
