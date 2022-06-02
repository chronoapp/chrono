from sqlalchemy import (
    Column,
    String,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class EventCalendar(Base):
    __tablename__ = 'event_calendar'
    event_id = Column(String, ForeignKey('event.id', ondelete='CASCADE'), primary_key=True)
    calendar_id = Column(String, ForeignKey('calendar.id', ondelete='CASCADE'), primary_key=True)

    event = relationship("Event", back_populates="calendars")
    calendar = relationship("Calendar", back_populates="events")
