from typing import Optional, TYPE_CHECKING
import shortuuid

from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import relationship, backref, Mapped, mapped_column

from app.db.base_class import Base

if TYPE_CHECKING:
    from .user import User


class Contact(Base):
    __tablename__ = 'contact'

    id = mapped_column(String(255), primary_key=True, default=shortuuid.uuid)
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)

    user_id = mapped_column(Integer, ForeignKey('user.id'), nullable=False)
    user: Mapped['User'] = relationship('User', back_populates='contacts')

    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    @property
    def display_name(self) -> Optional[str]:
        if self.first_name and self.last_name:
            return f'{self.first_name} {self.last_name}'
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email

    def __init__(
        self,
        first_name: Optional[str],
        last_name: Optional[str],
        email: Optional[str],
        photo_url: Optional[str],
        google_id: Optional[str],
    ):
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.photo_url = photo_url
        self.google_id = google_id

    def __repr__(self) -> str:
        return f'<Contact {self.id} {self.display_name}>'
