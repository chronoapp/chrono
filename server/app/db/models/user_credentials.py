import enum
import uuid

from sqlalchemy import Integer, ForeignKey, String, UUID, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


from app.db.base_class import Base


class ProviderType(enum.Enum):
    Google = 'google'
    Microsoft = 'microsoft'


class UserCredential(Base):
    """Represents a connected account (Google, Microsoft, etc) for a user."""

    __tablename__ = 'user_credentials'

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('user.id'), primary_key=True)
    provider: Mapped[str] = mapped_column(
        String(30),
        unique=False,
        nullable=False,
        primary_key=True,
    )

    token_data = mapped_column(JSONB, nullable=False)
    is_default = mapped_column(Boolean, nullable=False, default=True, server_default='true')

    def __init__(self, email: str, tokenData: dict, provider: ProviderType) -> None:
        self.email = email
        self.token_data = tokenData
        self.provider = provider.value
