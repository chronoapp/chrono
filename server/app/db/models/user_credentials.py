import enum
from sqlalchemy import Integer, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


from app.db.base_class import Base


class ProviderType(enum.Enum):
    Google = 'google'
    Microsoft = 'microsoft'


class UserCredential(Base):
    __tablename__ = 'user_credentials'
    user_id = mapped_column(Integer, ForeignKey('user.id'), primary_key=True)
    provider: Mapped[str] = mapped_column(
        String(30),
        unique=False,
        nullable=False,
        primary_key=True,
    )

    token_data = mapped_column(JSONB, nullable=False)

    def __init__(self, tokenData: dict, provider: ProviderType) -> None:
        self.token_data = tokenData
        self.provider = provider.value
