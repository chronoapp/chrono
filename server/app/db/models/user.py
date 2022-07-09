from typing import Optional, List

from sqlalchemy import Column, Integer, String, and_, select
from sqlalchemy.orm import relationship, selectinload

from app.db.base_class import Base
from app.db.models.user_credentials import ProviderType
from app.db.models.user_calendar import UserCalendar
from app.db.models.calendar import Calendar
from app.db.models.event import Event


class User(Base):
    __tablename__ = 'user'

    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    username = Column(String(255))
    hashed_password = Column(String(255))

    email = Column(String(255))
    name = Column(String(255))  # display name
    picture_url = Column(String(255))

    google_oauth_state = Column(String(255), nullable=True)
    credentials = relationship(
        'UserCredential',
        cascade='save-update, merge, delete, delete-orphan',
        uselist=False,
        backref='user',
    )

    timezone = Column(String(255), nullable=False, server_default='UTC')

    def __repr__(self):
        return f'<User {self.id=} {self.email=}/>'

    def __init__(self, email: str, name: str, pictureUrl: Optional[str]):
        self.email = email
        self.name = name
        self.picture_url = pictureUrl

    def getGoogleCalendars(self) -> List[UserCalendar]:
        return [cal for cal in self.calendars if cal.google_id != None]

    def getClassifierPath(self):
        return f'/var/lib/model_data/{self.username}.pkl'

    def syncWithGoogle(self) -> bool:
        return (
            self.credentials is not None
            and self.credentials.provider == ProviderType.Google
            and self.credentials.token_data
        )

    def getPrimaryCalendarStmt(self) -> UserCalendar:
        return select(UserCalendar).where(
            UserCalendar.user_id == self.id, UserCalendar.primary == True
        )

    def getSingleEventsStmt(self, showDeleted=False, showRecurring=True):
        """Events query without the base recurring events."""
        stmt = (
            select(Event)
            .options(selectinload(Event.participants))
            .options(selectinload(Event.labels))
            .join(Event.calendar)
            .join(Calendar.user_calendars)
            .join(User)
            .where(
                User.id == self.id,
                Event.recurrences == None,
            )
        )

        if not showRecurring:
            stmt = stmt.filter(Event.recurring_event_id == None)

        if showDeleted:
            return stmt
        else:
            return stmt.filter(Event.status != 'deleted')
