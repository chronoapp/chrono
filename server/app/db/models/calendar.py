from typing import Literal, Optional
import shortuuid

from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base
from app.db.models.event import Event

AccessRole = Literal['freeBusyReader', 'reader', 'writer', 'owner']
CalendarSource = Literal['google', 'timecouncil']


class Calendar(Base):
    __tablename__ = 'calendar'
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('calendars', lazy='joined', cascade='all,delete'))

    id = Column(String(255), unique=True, primary_key=True, default=shortuuid.uuid)

    # IDs for google / msft / aapl.
    google_id = Column(String(255), unique=True, nullable=True)

    timezone = Column(String(255), nullable=True)
    summary = Column(String(255))
    description = Column(Text())
    background_color = Column(String(10))
    foreground_color = Column(String(10))
    selected = Column(Boolean)
    access_role = Column(String(50))
    primary = Column(Boolean)
    deleted = Column(Boolean)

    # TODO: Rename to google_sync_token.
    sync_token = Column(String())

    webhook = relationship("Webhook", uselist=False, back_populates="calendar")

    def __repr__(self):
        return f'<Calendar id={self.id} summary={self.summary}/>'

    def __init__(
        self,
        id: str,
        timezone: Optional[str],
        summary: str,
        description: Optional[str],
        background_color: Optional[str],
        foreground_color: Optional[str],
        selected: bool,
        access_role: AccessRole,
        primary: bool,
        deleted: bool,
    ):
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

    @property
    def source(self) -> CalendarSource:
        if self.google_id:
            return 'google'
        else:
            return 'timecouncil'

    @property
    def isGoogleCalendar(self) -> bool:
        return self.sync_token is not None
