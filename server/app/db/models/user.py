import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import String, UUID, ForeignKey, ARRAY
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.ext.orderinglist import ordering_list

from app.db.base_class import Base
from app.db.models.user_account import CalendarProvider, UserAccount
from app.db.models.user_calendar import UserCalendar

if TYPE_CHECKING:
    from . import Label
    from .zoom import ZoomConnection


class User(Base):
    __tablename__ = 'user'

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, nullable=False, default=uuid.uuid4
    )
    username: Mapped[Optional[str]] = mapped_column(String(255))
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))  # display name
    picture_url: Mapped[Optional[str]] = mapped_column(String(255))

    accounts: Mapped[list[UserAccount]] = relationship(
        'UserAccount',
        cascade='save-update, merge, delete, delete-orphan',
    )
    zoom_connection: Mapped[Optional['ZoomConnection']] = relationship(
        'ZoomConnection',
        cascade='delete, delete-orphan',
        uselist=False,
        back_populates='user',
    )

    timezones: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)

    labels: Mapped[list['Label']] = relationship(
        'Label',
        lazy='joined',
        cascade='all,delete',
        order_by="Label.position",
        collection_class=ordering_list('position', count_from=0),
        back_populates='user',
    )

    default_calendar_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID,
        ForeignKey('user_calendar.id', name="fk_user_default_calendar", ondelete='SET NULL'),
        nullable=True,
    )
    default_calendar: Mapped[Optional[UserCalendar]] = relationship(
        'UserCalendar',
        foreign_keys='User.default_calendar_id',
        uselist=False,
    )

    def __repr__(self):
        return f'<User {self.id=} {self.email=}/>'

    def __init__(self, email: str, name: str, pictureUrl: Optional[str]):
        self.email = email
        self.name = name
        self.picture_url = pictureUrl

    @property
    def timezone(self) -> str:
        return self.timezones[0] if self.timezones else 'UTC'

    def getDefaultAccount(self) -> UserAccount:
        defaultAccount = next((c for c in self.accounts if c.is_default), None)
        if not defaultAccount:
            # There should always be a default linked calendar account.
            raise Exception('No default account found')

        return defaultAccount

    def getGoogleAccounts(self) -> list[UserAccount]:
        return [a for a in self.accounts if a.provider == CalendarProvider.Google.value]

    def getAccount(self, provider: CalendarProvider, email: str) -> UserAccount | None:
        return next(
            (a for a in self.accounts if a.provider == provider.value and a.email == email),
            None,
        )

    def getAccountById(self, accountId: uuid.UUID) -> UserAccount | None:
        return next((a for a in self.accounts if a.id == accountId), None)
