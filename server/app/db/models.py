from datetime import datetime
from google.oauth2.credentials import Credentials

from sqlalchemy import Boolean, Column, Integer,\
    String, Column, ForeignKey, BigInteger, Table, Text, DateTime, text
from sqlalchemy.orm import relationship, backref, Session

from app.db.base_class import Base
from app.db.session import engine


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


class UserCredential(Base):
    __tablename__ = 'user_credentials'
    user_id = Column(Integer,
                ForeignKey('user.id'),
                primary_key=True)

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
    Column('label_id', Integer, ForeignKey('label.id'))
)


class Event(Base):
    __tablename__ = 'event'
    id = Column(BigInteger, primary_key=True, nullable=False, index=True)
    g_id = Column(String(255), unique=True)

    # Many to one
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref(
        'events', lazy='dynamic', cascade='all,delete'))
    title = Column(String(255), index=True)
    description = Column(Text())
    start_time = Column(DateTime())
    end_time = Column(DateTime())
    labels = relationship('Label', lazy='joined', secondary=event_label_association_table)

    @classmethod
    def search(cls, session: Session, userId: str, searchQuery: str, limit: int = 100):
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

        rows = engine.execute(text(sqlQuery),
                query=searchQuery,
                userId=userId,
                limit=limit)

        rowIds = [r[0] for r in rows]

        return session.query(Event).filter(Event.id.in_(rowIds)).all()

    def __init__(self, g_id: str, title: str, description: str,
            start_time: datetime, end_time: datetime):
        self.g_id = g_id
        self.title = title
        self.description = description
        self.start_time = start_time
        self.end_time = end_time


class Label(Base):
    __tablename__ = 'label'
    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref(
        'labels', lazy='dynamic', cascade='all,delete'))
    title = Column(String(255))
    key = Column(String(50))

    def __init__(self, title: str, key: str):
        self.title = title
        self.key = key


class UserEventLabel(Base):
    """User defined label for an event.
    """
    __tablename__ = 'user_event_label'
    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref(
        'event_labels', lazy='dynamic', cascade='all,delete'))
    title = Column(String(255), index=True)
    label = Column(String(255))
