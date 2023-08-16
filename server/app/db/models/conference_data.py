import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    String,
    ForeignKey,
    UUID,
)
from sqlalchemy.orm import relationship, mapped_column, backref, Mapped

from app.db.base_class import Base

if TYPE_CHECKING:
    from .event import Event


class ConferenceData(Base):
    """Conference related information attached to an event,
    like Google Meet or Zoom.
    """

    __tablename__ = "conference_data"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    conference_solution_name: Mapped[str] = mapped_column(String)

    key_type: Mapped[str] = mapped_column(
        String
    )  # eventHangout / eventNamedHangout / hangoutsMeet / addOn
    icon_uri: Mapped[str] = mapped_column(String)
    conference_id: Mapped[str] = mapped_column(String)

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

    def __init__(self, conferenceSolutionName: str, keyType: str, iconUri: str, conferenceId: str):
        self.conference_solution_name = conferenceSolutionName
        self.key_type = keyType
        self.icon_uri = iconUri
        self.conference_id = conferenceId

    def __repr__(self) -> str:
        return f"<ConferenceData {self.conference_solution_name} entrypoints=[{self.entry_points}]>"


class EntryPoint(Base):
    """Ways to enter the meeting. For example, a Google Meet link or a phone number."""

    __tablename__ = "entry_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)

    entry_point_type: Mapped[str] = mapped_column(String)
    uri: Mapped[str] = mapped_column(String)
    label: Mapped[str] = mapped_column(String)
    meeting_code: Mapped[str | None] = mapped_column(String, nullable=True)
    password: Mapped[str | None] = mapped_column(String, nullable=True)

    # ForeignKey for the one-to-many relationship
    conference_data_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey('conference_data.id'))

    def __init__(
        self,
        entryPointType: str,
        uri: str,
        label: str,
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
