import uuid
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import String, UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.ext.orderinglist import ordering_list

from app.db.base_class import Base
from app.db.models.user_account import ProviderType, UserAccount
from app.db.models.user_calendar import UserCalendar

if TYPE_CHECKING:
    from .label import Label
    from .contact import Contact
    from .webhook import Webhook


class User(Base):
    __tablename__ = 'user'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, nullable=False, default=uuid.uuid4
    )
    username: Mapped[Optional[str]] = mapped_column(String(255))
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))

    email: Mapped[Optional[str]] = mapped_column(String(255))
    name: Mapped[Optional[str]] = mapped_column(String(255))  # display name
    picture_url: Mapped[Optional[str]] = mapped_column(String(255))

    accounts: Mapped[list[UserAccount]] = relationship(
        'UserAccount',
        cascade='save-update, merge, delete, delete-orphan',
        backref='user',
    )
    timezone: Mapped[str] = mapped_column(String(255), nullable=False, server_default='UTC')

    calendars: Mapped[list[UserCalendar]] = relationship(
        "UserCalendar", back_populates='user', lazy='joined', cascade='all,delete'
    )
    labels: Mapped[list['Label']] = relationship(
        'Label',
        lazy='joined',
        cascade='all,delete',
        order_by="Label.position",
        collection_class=ordering_list('position', count_from=0),
        back_populates='user',
    )
    contacts: Mapped[list['Contact']] = relationship(
        'Contact', lazy='dynamic', cascade='all,delete'
    )
    webhooks: Mapped[list['Webhook']] = relationship(
        "Webhook",
        back_populates="user",
        cascade='all,delete',
    )

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

    def getDefaultAccount(self) -> UserAccount:
        defaultAccount = next((c for c in self.accounts if c.is_default), None)
        if not defaultAccount:
            # There should always be a default linked calendar account.
            raise Exception('No default account found')

        return defaultAccount

    def getAccount(self, provider: ProviderType, email: str) -> Optional[UserAccount]:
        return next(
            (a for a in self.accounts if a.provider == provider.value and a.email == email),
            None,
        )
