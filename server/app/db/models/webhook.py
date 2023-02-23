import uuid
from typing import TYPE_CHECKING

from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.db.base_class import Base

if TYPE_CHECKING:
    from .user_calendar import UserCalendar


class Webhook(Base):
    """Google webhook to track calendar updates"""

    __tablename__ = 'webhook'
    id: Mapped[str] = mapped_column(String, primary_key=True, nullable=False)

    calendar_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey('user_calendar.id'), nullable=False
    )
    calendar: Mapped['UserCalendar'] = relationship('UserCalendar', back_populates='webhook')

    resource_id: Mapped[str] = mapped_column(String())
    resource_uri: Mapped[str] = mapped_column(String())
    expiration: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    def __repr__(self) -> str:
        return f'<Webhook {self.id=} {self.calendar_id=} {self.expiration=}>'

    def __init__(self, id: str, resourceId: str, resourceUri: str, expirationTimestampMs: int):
        self.id = id
        self.resource_id = resourceId
        self.resource_uri = resourceUri
        self.expiration = datetime.fromtimestamp(expirationTimestampMs / 1000)
