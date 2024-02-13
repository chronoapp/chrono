from typing import TYPE_CHECKING
import uuid

from sqlalchemy import String, ForeignKey, Text, UUID
from sqlalchemy.orm import relationship, mapped_column, Mapped, backref

from app.db.base_class import Base

if TYPE_CHECKING:
    from . import User


class ZoomConnection(Base):
    """Stores the Zoom connection data for a user. This is used to connect to the Zoom API."""

    __tablename__ = 'zoom_connection'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, nullable=False, default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey('user.id', ondelete='CASCADE', name="fk_zoom_user_id")
    )
    user: Mapped['User'] = relationship('User', back_populates='zoom_connection', uselist=False)

    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    def __init__(self, access_token: str, refresh_token: str, scope: str, email: str):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.scope = scope
        self.email = email
