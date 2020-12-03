from datetime import datetime
from typing import Optional, List

from sqlalchemy import Column, Integer,\
    String, ForeignKey, BigInteger, Table, Text, DateTime, text, desc
from sqlalchemy.orm import relationship, backref, Session

from app.db.sql.event_search import EVENT_SEARCH_QUERY
from app.db.base_class import Base
from app.db.session import engine

event_label_association_table = Table('event_label', Base.metadata,
                                      Column('event_id', BigInteger, ForeignKey('event.id')),
                                      Column('label_id', Integer, ForeignKey('label.id')))


class Event(Base):
    __tablename__ = 'event'
    id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    g_id = Column(String(255), unique=True)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('events', lazy='dynamic', cascade='all,delete'))

    calendar_id = Column(String(255), ForeignKey('calendar.id'), nullable=False)
    calendar = relationship('Calendar',
                            backref=backref('events', lazy='dynamic', cascade='all,delete'))

    title = Column(String(255), index=True)
    description = Column(Text())

    start = Column(DateTime(timezone=True))
    end = Column(DateTime(timezone=True))
    # TODO: Validate these fields.
    start_day = Column(String(10), nullable=True)  # YYYY-MM-DD date if full day
    end_day = Column(String(10), nullable=True)  # YYYY-MM-DD date if full day
    time_zone = Column(String(255))

    labels = relationship('Label', lazy='joined', secondary=event_label_association_table)

    @classmethod
    def search(cls,
               session: Session,
               userId: str,
               searchQuery: str,
               limit: int = 250) -> List['Event']:
        rows = engine.execute(text(EVENT_SEARCH_QUERY),
                              query=searchQuery,
                              userId=userId,
                              limit=limit)

        rowIds = [r[0] for r in rows]

        return session.query(Event).filter(Event.id.in_(rowIds))\
            .order_by(desc(Event.end)).all()

    @property
    def background_color(self):
        return self.calendar.background_color

    @property
    def all_day(self):
        return self.start_day is not None and self.end_day is not None

    def __init__(self, g_id: Optional[str], title: Optional[str], description: Optional[str],
                 start: datetime, end: datetime, start_day: Optional[str], end_day: Optional[str],
                 calendar_id: str):
        self.g_id = g_id
        self.title = title
        self.description = description
        self.start = start
        self.end = end
        self.start_day = start_day
        self.end_day = end_day
        self.calendar_id = calendar_id

    def __repr__(self):
        return f'<Event {self.title} start:{self.start} end:{self.end}/>'

    def isWritable(self) -> bool:
        return self.calendar.access_role == 'writer'\
            or self.calendar.access_role == 'owner'
