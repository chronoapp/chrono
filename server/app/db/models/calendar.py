from typing import Literal

from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base
from app.db.models.event import Event

AccessRole = Literal['freeBusyReader', 'reader', 'writer', 'owner']


class Calendar(Base):
    __tablename__ = 'calendar'
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('calendars', lazy='dynamic', cascade='all,delete'))

    id = Column(String(255), unique=True, primary_key=True)
    timezone = Column(String(255))
    summary = Column(String(255))
    description = Column(Text())
    background_color = Column(String(10))
    foreground_color = Column(String(10))
    selected = Column(Boolean)
    access_role = Column(String(50))
    primary = Column(Boolean)
    deleted = Column(Boolean)

    sync_token = Column(String())

    webhook = relationship("Webhook", uselist=False, back_populates="calendar")

    def __init__(self, id: str, timezone: str, summary: str, description: str,
                 background_color: str, foreground_color: str, selected: bool,
                 access_role: AccessRole, primary: bool, deleted: bool):
        self.id = id
        self.timezone = timezone
        self.summary = summary
        self.description = description
        self.background_color = background_color
        self.foreground_color = foreground_color
        self.selected = selected
        self.access_role = access_role
        self.primary = primary
        self.deleted = deleted

    def getEvents(self, expandSingleEvents: bool = True):
        if expandSingleEvents:
            return self.events.filter_by(recurrences=None)
        else:
            # TODO: modified recurring events
            return self.events.filter(Event.recurring_event_id == None)
