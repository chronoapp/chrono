from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, Integer,\
    String, ForeignKey, BigInteger, Table, Text, DateTime, text, desc
from sqlalchemy.orm import relationship, backref, Session

from app.db.base_class import Base
from app.db.session import engine

from .user import User
from .user_credentials import *
from .calendar import Calendar

DEFAULT_TAG_COLOR = '#cecece'

# TODO: Store Timezone
# class UserSettings(Base):
#     user_id = Column(Integer, ForeignKey('user.id'), primary_key=True)
#     locale = Column(String(25))
#     timezone = Column(String(255))

event_label_association_table = Table('event_label', Base.metadata,
                                      Column('event_id', BigInteger, ForeignKey('event.id')),
                                      Column('label_id', Integer, ForeignKey('label.id')))


class Webhook(Base):
    """Google webhook to track calendar updates
    """
    __tablename__ = 'webhook'
    id = Column(String, primary_key=True, nullable=False)

    calendar_id = Column(String(255), ForeignKey('calendar.id'), nullable=False)
    calendar = relationship('Calendar', back_populates='webhook')

    resource_id = Column(String())
    resource_uri = Column(String())

    def __repr__(self):
        return f'<Webhook {self.id} {self.calendar_id}>'

    def __init__(self, id: str, resourceId: str, resourceUri: str):
        self.id = id
        self.resource_id = resourceId
        self.resource_uri = resourceUri


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

    def __init__(self, g_id: Optional[str], title: Optional[str], description: Optional[str],
                 start: datetime, end: datetime, calendar_id: str):
        self.g_id = g_id
        self.title = title
        self.description = description
        self.start = start
        self.end = end
        self.calendar_id = calendar_id


class Label(Base):
    __tablename__ = 'label'
    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    parent_id = Column(BigInteger, ForeignKey('label.id'), nullable=True)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref('labels', lazy='dynamic', cascade='all,delete'))
    title = Column(String(255))
    key = Column(String(50), index=True)
    color_hex = Column(String(50), nullable=False)

    # Position within parent node.
    position = Column(Integer, default=0)

    def __init__(self, title: str, color_hex: str = DEFAULT_TAG_COLOR) -> None:
        self.title = title
        self.color_hex = color_hex
        self.position = 0

    def __repr__(self):
        return f'<Label {self.id} {self.title}/>'


class LabelRule(Base):
    """Rule to always add a Label to the event when the title is {LabelRule.text}
    when the calendar syncs.
    """
    __tablename__ = 'label_rule'
    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    text = Column(String(255), nullable=False)

    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User',
                        backref=backref('label_rules', lazy='dynamic', cascade='all,delete'))

    label_id = Column(Integer, ForeignKey('label.id'), nullable=False)
    label = relationship('Label', backref=backref('rules', lazy='dynamic', cascade='all,delete'))

    def __init__(self, text: str):
        self.text = text

    def __repr__(self):
        return f'<LabelRule {self.text} {self.label.title}>'
