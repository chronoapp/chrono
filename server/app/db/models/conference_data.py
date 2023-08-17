import uuid
from typing import TYPE_CHECKING, Optional
from enum import Enum

from sqlalchemy import String, ForeignKey, UUID, Enum as SQLAlchemyEnum
from sqlalchemy.orm import relationship, mapped_column, backref, Mapped

from app.db.base_class import Base

if TYPE_CHECKING:
    from .event import Event


class CommunicationMethod(Enum):
    VIDEO = "video"
    PHONE = "phone"
    SIP = "sip"
    MORE = "more"


class ConferenceKeyType(Enum):
    EVENT_HANGOUT = "eventHangout"
    EVENT_NAMED_HANGOUT = "eventNamedHangout"
    HANGOUTS_MEET = "hangoutsMeet"
    ADD_ON = "addOn"


class ConferenceCreateStatus(Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILURE = "failure"


SQLAlchemyEnumConferenceKeyType = SQLAlchemyEnum(ConferenceKeyType, name='conferencekeytype')


class ConferenceData(Base):
    """Conference related information attached to an event,
    like Google Meet or Zoom.
    """

    __tablename__ = "conference_data"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    conference_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # One-to-one relationship fields
    event: Mapped['Event'] = relationship("Event", back_populates="conference_data")
    event_uid: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('event.uid'), nullable=True)

    # One-to-many relationship with EntryPoint
    entry_points: Mapped[list['EntryPoint']] = relationship(
        "EntryPoint",
        lazy='joined',
        cascade="all, delete-orphan",
        backref=backref('conference_data', lazy='joined'),
    )

    conference_solution: Mapped[Optional['ConferenceSolution']] = relationship(
        "ConferenceSolution",
        lazy='joined',
        uselist=False,
        cascade="all,delete",
        backref=backref('conference_data', lazy='joined'),
    )

    create_request: Mapped[Optional['CreateRequest']] = relationship(
        "CreateRequest",
        lazy='joined',
        uselist=False,
        cascade="all,delete",
        backref=backref('conference_data', lazy='joined'),
    )

    def __init__(
        self,
        conferenceId: str | None,
        conferenceSolution: Optional['ConferenceSolution'],
    ):
        self.conference_id = conferenceId
        self.conference_solution = conferenceSolution

    def __repr__(self) -> str:
        return f"<ConferenceData {self.conference_id} entrypoints=[{self.entry_points}]>"


class ConferenceSolution(Base):
    """Conference solution like Google Meet or Zoom."""

    __tablename__ = "conference_solutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    conference_data_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('conference_data.id'))

    name: Mapped[str] = mapped_column(String)
    key_type: Mapped[ConferenceKeyType] = mapped_column(SQLAlchemyEnumConferenceKeyType)
    icon_uri: Mapped[str] = mapped_column(String)

    def __init__(self, name: str, keyType: ConferenceKeyType, iconUri: str):
        self.name = name
        self.key_type = keyType
        self.icon_uri = iconUri

    def __repr__(self) -> str:
        return f"<ConferenceSolution {self.name}>"


class CreateRequest(Base):
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    conference_data_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('conference_data.id'))

    status: Mapped[ConferenceCreateStatus] = mapped_column(SQLAlchemyEnum(ConferenceCreateStatus))
    request_id: Mapped[str] = mapped_column(String)
    conference_solution_key_type: Mapped[ConferenceKeyType] = mapped_column(
        SQLAlchemyEnumConferenceKeyType
    )

    def __init__(
        self,
        status: ConferenceCreateStatus,
        requestId: str,
        conferenceSolutionKeyType: ConferenceKeyType,
    ):
        self.status = status
        self.request_id = requestId
        self.conference_solution_key_type = conferenceSolutionKeyType

    def __repr__(self) -> str:
        return f"<CreateRequest {self.status} {self.conference_solution_key_type}>"


class EntryPoint(Base):
    """Ways to enter the meeting. For example, a Google Meet link or a phone number."""

    __tablename__ = "entry_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)

    entry_point_type: Mapped[CommunicationMethod] = mapped_column(
        SQLAlchemyEnum(CommunicationMethod)
    )
    uri: Mapped[str] = mapped_column(String)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    meeting_code: Mapped[str | None] = mapped_column(String, nullable=True)
    password: Mapped[str | None] = mapped_column(String, nullable=True)

    # ForeignKey for the one-to-many relationship
    conference_data_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('conference_data.id'))

    def __init__(
        self,
        entryPointType: CommunicationMethod,
        uri: str,
        label: str | None,
        meetingCode: str | None,
        password: str | None,
    ):
        self.entry_point_type = entryPointType
        self.uri = uri
        self.label = label
        self.meeting_code = meetingCode
        self.password = password

    def __repr__(self) -> str:
        return f"<EntryPoint {self.entry_point_type} {self.label}>"
