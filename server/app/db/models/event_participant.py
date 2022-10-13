from typing import Optional, Literal
import shortuuid

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base_class import Base


ResponseStatus = Literal['needsAction', 'accepted', 'declined', 'tentative']
EventParticipantType = Literal['attendee', 'creator', 'organizer']


class EventParticipant(Base):
    """Participants of an event. Optionally linked to a Contact.
    If so, the linked Contact should always be eager loaded so we can
    merge its diplay data.
    """

    __tablename__ = 'event_participant'

    id = Column(String(255), primary_key=True, default=shortuuid.uuid)

    event_pk = Column(String(255), ForeignKey('event.pk'), nullable=True)
    email_ = Column(String(255), nullable=True, index=True)
    display_name_ = Column(String(255), nullable=True)

    contact_id = Column(String(255), ForeignKey('contact.id'), nullable=True)
    contact = relationship(
        'Contact', lazy="joined", backref="participating_events", foreign_keys=[contact_id]
    )
    response_status = Column(String(255), nullable=True)

    # Used for joined table inheritance. An EventParticipant can be a creator, organizer, or attendee.
    type_ = Column(String(20), nullable=False)

    __mapper_args__ = {"polymorphic_on": type_}

    @property
    def photo_url(self) -> Optional[str]:
        if self.contact:
            return self.contact.photo_url
        else:
            return None

    @property
    def display_name(self) -> Optional[str]:
        if self.display_name_:
            return self.display_name_
        if self.contact:
            return self.contact.display_name
        else:
            return self.email

    @property
    def email(self) -> Optional[str]:
        if self.email_:
            return self.email_
        elif self.contact:
            return self.contact.email
        else:
            return None

    @property
    def is_self(self) -> bool:
        return self.event.calendar.email == self.email_

    def __init__(
        self,
        type: EventParticipantType,
        email: Optional[str],
        displayName: Optional[str],
        contactId: Optional[str],
        responseStatus: Optional[ResponseStatus],
    ):
        self.type_ = type
        self.email_ = email
        self.display_name_ = displayName
        self.contact_id = contactId
        self.response_status = responseStatus

    def __repr__(self) -> str:
        return f'<EventParticipant {self.email_} {self.display_name} {self.response_status}>'


class EventAttendee(EventParticipant):
    __mapper_args__ = {"polymorphic_identity": "attendee"}

    def __init__(
        self,
        email: Optional[str],
        displayName: Optional[str],
        contactId: Optional[str],
        responseStatus: Optional[ResponseStatus],
    ):
        super().__init__(
            type="attendee",
            email=email,
            displayName=displayName,
            contactId=contactId,
            responseStatus=responseStatus,
        )

    def __repr__(self) -> str:
        return f'<EventAttendee {self.email_} {self.display_name} {self.response_status}>'


class EventCreator(EventParticipant):
    __mapper_args__ = {"polymorphic_identity": "creator"}

    def __init__(self, email: Optional[str], displayName: Optional[str], contactId: Optional[str]):
        super().__init__(
            type="creator",
            email=email,
            displayName=displayName,
            contactId=contactId,
            responseStatus=None,
        )

    def __repr__(self) -> str:
        return f'<EventCreator {self.email_} {self.display_name}>'


class EventOrganizer(EventParticipant):
    __mapper_args__ = {"polymorphic_identity": "organizer"}

    def __init__(self, email: Optional[str], displayName: Optional[str], contactId: Optional[str]):
        super().__init__(
            type="organizer",
            email=email,
            displayName=displayName,
            contactId=contactId,
            responseStatus=None,
        )

    def __repr__(self) -> str:
        return f'<EventOrganizer {self.email_} {self.display_name}>'
