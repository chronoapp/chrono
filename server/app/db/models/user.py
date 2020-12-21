from typing import Optional

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.models.user_credentials import ProviderType
from app.db.models.calendar import Calendar
from app.db.models.event import Event


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

    def __init__(self, email: str, name: str, pictureUrl: Optional[str]):
        self.email = email
        self.name = name
        self.picture_url = pictureUrl

    def getClassifierPath(self):
        return f'/var/lib/model_data/{self.username}.pkl'

    def syncWithGoogle(self) -> bool:
        # TODO: sync on a per-calendar basis.
        return self.credentials\
            and self.credentials.provider == ProviderType.Google\
            and self.credentials.token_data

    def getPrimaryCalendar(self) -> Calendar:
        return self.calendars.filter_by(primary=True).one()

    def getEvents(self, expandSingleEvents: bool = True):
        if expandSingleEvents:
            return self.events.filter_by(recurrences=None)
        else:
            # TODO: modified recurring events
            return self.events.filter_by(recurring_event_id=None)
