from datetime import datetime
from typing import Optional, List, Literal
import shortuuid

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Table,
    Text,
    DateTime,
    text,
    desc,
    ARRAY,
)
from sqlalchemy.orm import relationship, backref, Session

from app.db.sql.event_search import EVENT_SEARCH_QUERY
from app.db.base_class import Base
from app.db.session import engine

event_label_association_table = Table(
    'event_label',
    Base.metadata,
    Column('event_id', String, ForeignKey('event.id')),
    Column('label_id', Integer, ForeignKey('label.id')),
)

EventStatus = Literal['deleted', 'tentative', 'active']


class Event(Base):
    __tablename__ = 'event'
    id = Column(String, primary_key=True, default=shortuuid.uuid, nullable=False)

    # Google-specific
    g_id = Column(String(255), unique=True)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('events', lazy='dynamic', cascade='all,delete'))

    calendar_id = Column(String(255), ForeignKey('calendar.id'), nullable=False)
    calendar = relationship(
        'Calendar',
        backref=backref(
            'events', lazy='dynamic', cascade='all,delete', order_by='Event.start.asc()'
        ),
    )

    title = Column(String(255), index=True)
    description = Column(Text())
    status = Column(String(20), server_default='active')

    start = Column(DateTime(timezone=True), nullable=True)
    end = Column(DateTime(timezone=True), nullable=True)

    # TODO: Validate these fields.
    start_day = Column(String(10), nullable=True)  # YYYY-MM-DD date if full day
    end_day = Column(String(10), nullable=True)  # YYYY-MM-DD date if full day
    time_zone = Column(String(255))

    labels = relationship('Label', lazy='joined', secondary=event_label_association_table)

    # Recurring Events.
    recurrences = Column(ARRAY(String), nullable=True)
    recurring_event_id = Column(String, ForeignKey('event.id'), nullable=True)
    recurring_event = relationship(lambda: Event, remote_side=id, backref='recurring_events')

    # Original time (For recurring events).
    original_start = Column(DateTime(timezone=True))
    original_start_day = Column(String(10))
    original_timezone = Column(String(255))

    @classmethod
    def search(cls, session: Session, userId: str, searchQuery: str, limit: int = 250):
        rows = engine.execute(
            text(EVENT_SEARCH_QUERY), query=searchQuery, userId=userId, limit=limit
        )

        rowIds = [r[0] for r in rows]

        return session.query(Event).filter(Event.id.in_(rowIds)).order_by(desc(Event.end))

    @property
    def background_color(self):
        return self.calendar.background_color

    @property
    def all_day(self):
        return self.start_day is not None and self.end_day is not None

    @property
    def is_parent_recurring_event(self) -> bool:
        return self.recurrences is not None and len(self.recurrences) > 0

    def getTimezone(self) -> str:
        if self.time_zone:
            return self.time_zone
        else:
            return self.calendar.timezone

    def __init__(
        self,
        g_id: Optional[str],
        title: Optional[str],
        description: Optional[str],
        start: Optional[datetime],
        end: Optional[datetime],
        start_day: Optional[str],
        end_day: Optional[str],
        calendar_id: str,
        timezone: Optional[str],
        recurrences: Optional[List[str]],
        copyOriginalStart=False,
    ):
        self.g_id = g_id
        self.title = title
        self.description = description
        self.start = start
        self.end = end
        self.start_day = start_day
        self.end_day = end_day
        self.calendar_id = calendar_id
        self.time_zone = timezone
        self.recurrences = recurrences

        if copyOriginalStart:
            self.original_start = start
            self.original_start_day = start_day
            self.original_timezone = timezone

    def __repr__(self):
        return f'<Event {self.id} {self.title} start:{self.start} end:{self.end}/>'

    def isWritable(self) -> bool:
        return self.calendar.access_role == 'writer' or self.calendar.access_role == 'owner'
