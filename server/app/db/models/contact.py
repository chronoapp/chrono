from typing import Optional
import shortuuid

from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base


class Contact(Base):
    __tablename__ = 'contact'

    id = Column(String(255), unique=True, primary_key=True, default=shortuuid.uuid)
    google_id = Column(String(255), unique=True, nullable=True)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('contacts', lazy='dynamic', cascade='all,delete'))

    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    email_address = Column(String(255), nullable=True)

    def __init__(
        self,
        first_name: Optional[str],
        last_name: Optional[str],
        email_address: Optional[str],
        google_id: Optional[str],
    ):
        self.first_name = first_name
        self.last_name = last_name
        self.email_address = email_address
        self.google_id = google_id