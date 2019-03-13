from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (
    Column, String, Integer, ForeignKey,
    DateTime, Date, Boolean, BigInteger, Text
)
from sqlalchemy import func, Table
from sqlalchemy.orm import relationship, backref

from api import db

Base = declarative_base()

class User(Base):
    __tablename__ = 'user'
    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    username = Column(String(255))

    def __init__(self, username):
        self.username = username

event_label_association_table = Table('event_label', Base.metadata,
    Column('event_id', BigInteger, ForeignKey('event.id')),
    Column('label_id', Integer, ForeignKey('label.id'))
)

class Event(Base):
    __tablename__ = 'event'
    id = Column(BigInteger, primary_key=True, nullable=False)
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

    def __init__(self, g_id: str, title: str, description: str,
        start_time: datetime, end_time: datetime):
        self.g_id = g_id
        self.title = title
        self.description = description
        self.start_time = start_time
        self.end_time = end_time

    def toJson(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'start_time': self.start_time,
            'end_time': self.start_time,
            'labels': [l.toJson() for l in self.labels]
        }


class Label(Base):
    __tablename__ = 'label'
    id = Column(BigInteger, primary_key=True, autoincrement=True, nullable=False)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=False)
    user = relationship('User', backref=backref(
        'labels', lazy='dynamic', cascade='all,delete'))
    title = Column(String(255))
    key = Column(String(50))

    def __init__(self, title):
        self.title = title

    def toJson(self):
        return {
            'title': self.title,
            'key': self.key
        }


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
