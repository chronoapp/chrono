from typing import Optional
import shortuuid

from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship

from app.db.base_class import Base


"""The base calendar is attached to an Event.
Every event many-1 relationship to this calendar.
"""


class Calendar(Base):
    __tablename__ = 'calendar'

    id = Column(String(255), primary_key=True, default=shortuuid.uuid)

    google_id = Column(String(255), unique=True, nullable=True)
    summary = Column(String(255))
    description = Column(Text())
    timezone = Column(String(255), nullable=True)

    email_ = Column(String(255), nullable=True)
    user_calendars = relationship("UserCalendar", foreign_keys='[UserCalendar.id]')

    events = relationship(
        'EventCalendar',
        lazy='dynamic',
        back_populates="calendar",
    )

    @property
    def email(self):
        if self.google_id:
            return self.google_id
        else:
            return self.email_

    def __init__(
        self,
        id: str,
        summary: Optional[str],
        description: Optional[str],
        timezone: str,
        email: Optional[str],
    ):
        self.id = id
        self.summary = summary
        self.description = description
        self.timezone = timezone
        self.email_ = email

    def __repr__(self):
        return f'<Calendar id={self.id} summary={self.summary}/>'
