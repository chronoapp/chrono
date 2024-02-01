from typing import TYPE_CHECKING
import enum
import uuid

from sqlalchemy import ForeignKey, String, UUID, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship


from app.db.base_class import Base

if TYPE_CHECKING:
    from app.db.models import UserCalendar, Webhook, User


class CalendarProvider(enum.Enum):
    Google = 'google'
    Microsoft = 'microsoft'
    Chrono = 'chrono'


class UserAccount(Base):
    """Represents a connected account (Google, Microsoft, etc) for a user."""

    __tablename__ = 'user_credentials'
    id: Mapped[uuid.UUID] = mapped_column(
        UUID,
        primary_key=True,
        nullable=False,
        default=uuid.uuid4,
    )

    email: Mapped[str] = mapped_column(String(255), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('user.id'))
    user: Mapped['User'] = relationship('User', back_populates='accounts')

    provider: Mapped[str] = mapped_column(
        String(30),
        unique=False,
        nullable=False,
    )

    token_data = mapped_column(JSONB, nullable=False)
    is_default = mapped_column(Boolean, nullable=False, default=True, server_default='true')

    calendars: Mapped[list['UserCalendar']] = relationship(
        "UserCalendar", back_populates='account', lazy='joined', cascade='all,delete'
    )
    webhooks: Mapped[list['Webhook']] = relationship(
        "Webhook", back_populates='account', cascade='all,delete'
    )

    def __init__(
        self, email: str, tokenData: dict, provider: CalendarProvider, isDefault: bool = True
    ) -> None:
        self.email = email
        self.token_data = tokenData
        self.provider = provider.value
        self.is_default = isDefault

    def __repr__(self):
        return f'<UserAccount {self.email=} {self.provider=} {self.is_default=} />'
