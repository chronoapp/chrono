from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, Integer,\
    String, Column, ForeignKey, BigInteger, Table, Text, DateTime, text, desc
from sqlalchemy.orm import relationship, backref, Session

from app.db.base_class import Base
from app.db.session import engine

DEFAULT_TAG_COLOR = '#cecece'


class User(Base):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    username = Column(String(255))

    email = Column(String(255))
    name = Column(String(255))
    picture_url = Column(String(255))

    google_oauth_state = Column(String(255), nullable=True)
    credentials = relationship('UserCredential',
                               cascade='save-update, merge, delete, delete-orphan',
                               uselist=False,
                               backref='user')

    def __init__(self, email, name, pictureUrl):
        self.email = email
        self.name = name
        self.picture_url = pictureUrl

    def getClassifierPath(self):
        return f'/var/lib/model_data/{self.username}.pkl'

    def syncWithGoogle(self) -> bool:
        # TODO: store sync settings
        return self.credentials and self.credentials.token


class UserCredential(Base):
    __tablename__ = 'user_credentials'
    user_id = Column(Integer, ForeignKey('user.id'), primary_key=True)

    token = Column(String(255), index=True)
    refresh_token = Column(String(255))
    token_uri = Column(String(255))
    client_id = Column(String(255))
    client_secret = Column(String(255))
    scopes = Column(String(255))

    def __init__(self, credentials):
        self.token = credentials.token,
        self.refresh_token = credentials.refresh_token,
        self.token_uri = credentials.token_uri,
        self.client_id = credentials.client_id,
        self.client_secret = credentials.client_secret,
        self.scopes = credentials.scopes

    def toDict(self):
        return {
            'token': self.token,
            'refresh_token': self.refresh_token,
            'token_uri': self.token_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scopes': self.scopes
        }


event_label_association_table = Table('event_label', Base.metadata,
                                      Column('event_id', BigInteger, ForeignKey('event.id')),
                                      Column('label_id', Integer, ForeignKey('label.id')))


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

    def __init__(self, id: str, timezone: str, summary: str, description: str,
                 background_color: str, foreground_color: str, selected: bool, access_role: str,
                 primary: bool, deleted: bool):
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

    def __init__(self, title: str, key: str) -> None:
        self.title = title
        self.key = key
        self.color_hex = DEFAULT_TAG_COLOR

    def __repr__(self):
        return f'<Label {self.key} {self.title}/>'


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
