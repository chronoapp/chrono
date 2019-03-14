from datetime import datetime
from sqlalchemy import func, Table

from api import db


class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    username = db.Column(db.String(255))

    def __init__(self, username):
        self.username = username


event_label_association_table = Table('event_label', db.Model.metadata,
    db.Column('event_id', db.BigInteger, db.ForeignKey('event.id')),
    db.Column('label_id', db.Integer, db.ForeignKey('label.id'))
)


class Event(db.Model):
    __tablename__ = 'event'
    id = db.Column(db.BigInteger, primary_key=True, nullable=False)
    g_id = db.Column(db.String(255), unique=True)

    # Many to one
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref(
        'events', lazy='dynamic', cascade='all,delete'))
    title = db.Column(db.String(255), index=True)
    description = db.Column(db.Text())
    start_time = db.Column(db.DateTime())
    end_time = db.Column(db.DateTime())
    labels = db.relationship('Label', lazy='joined', secondary=event_label_association_table)

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


class Label(db.Model):
    __tablename__ = 'label'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref(
        'labels', lazy='dynamic', cascade='all,delete'))
    title = db.Column(db.String(255))
    key = db.Column(db.String(50))

    def __init__(self, title):
        self.title = title

    def toJson(self):
        return {
            'title': self.title,
            'key': self.key
        }


class UserEventLabel(db.Model):
    """User defined label for an event.
    """
    __tablename__ = 'user_event_label'
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref(
        'event_labels', lazy='dynamic', cascade='all,delete'))
    title = db.Column(db.String(255), index=True)
    label = db.Column(db.String(255))
