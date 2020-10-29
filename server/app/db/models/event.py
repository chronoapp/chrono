from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer,\
    String, ForeignKey, BigInteger, Table, Text, DateTime, text, desc
from sqlalchemy.orm import relationship, backref, Session

from app.db.base_class import Base
from app.db.session import engine

event_label_association_table = Table('event_label', Base.metadata,
                                      Column('event_id', BigInteger, ForeignKey('event.id')),
                                      Column('label_id', Integer, ForeignKey('label.id')))


class Event(Base):
    __tablename__ = 'event'
    id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    g_id = Column(String(255), unique=True)

    # Many to one
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('events', lazy='dynamic', cascade='all,delete'))

    calendar_id = Column(String(255), ForeignKey('calendar.id'), nullable=False)
    calendar = relationship('Calendar',
                            backref=backref('events', lazy='dynamic', cascade='all,delete'))

    title = Column(String(255), index=True)
    description = Column(Text())

    start = Column(DateTime(timezone=True))
    end = Column(DateTime(timezone=True))
    time_zone = Column(String(255))

    labels = relationship('Label', lazy='joined', secondary=event_label_association_table)

    @classmethod
    def search(cls, session: Session, userId: str, searchQuery: str, limit: int = 250):
        sqlQuery = """
            SELECT id FROM (
                SELECT event.*,
                    setweight(to_tsvector('english', event.title), 'A') ||
                    setweight(to_tsvector('english', coalesce(event.description, '')), 'B') as doc
                FROM event
                WHERE event.user_id = :userId
            ) search
            WHERE search.doc @@ to_tsquery(:query || ':*')
            ORDER BY ts_rank(search.doc, to_tsquery(:query || ':*')) DESC
            LIMIT :limit;
        """

        rows = engine.execute(text(sqlQuery), query=searchQuery, userId=userId, limit=limit)

        rowIds = [r[0] for r in rows]

        return session.query(Event).filter(Event.id.in_(rowIds))\
            .order_by(desc(Event.end)).all()

    @property
    def background_color(self):
        return self.calendar.background_color

    @property
    def all_day(self):
        def isDayEvent(date):
            return date.hour == 0 and date.minute == 0 and date.second == 0

        return isDayEvent(self.start) and isDayEvent(self.end)

    @property
    def start_date(self):
        return self.start.strftime('%Y-%m-%d') if self.all_day else None

    @property
    def end_date(self):
        return self.end.strftime('%Y-%m-%d') if self.all_day else None

    def __init__(self, g_id: Optional[str], title: Optional[str], description: Optional[str],
                 start: datetime, end: datetime, calendar_id: str):
        self.g_id = g_id
        self.title = title
        self.description = description
        self.start = start
        self.end = end
        self.calendar_id = calendar_id

    def __repr__(self):
        return f'<Event {self.title} start:{self.start} end:{self.end}/>'