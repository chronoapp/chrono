from typing import Optional, Literal
import shortuuid

from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base


ParticipantStatus = Literal['needsAction', 'accepted', 'declined', 'tentative']


class EventParticipant(Base):
    """Participants of an event. Optionally linked to a Contact.
    If so, the linked Contact should always be eager loaded so we can
    merge its diplay data.
    """

    __tablename__ = 'event_participant'

    id = Column(String(255), primary_key=True, default=shortuuid.uuid)
    email = Column(String(255), nullable=False, index=True)

    event_id = Column(String(255), ForeignKey('event.id'), nullable=False)
    event = relationship('Event', back_populates='participants')

    contact_id = Column(String(255), ForeignKey('contact.id'), nullable=True)
    contact = relationship('Contact', lazy="joined", backref="participating_events")

    response_status = Column(String(255), nullable=False, default='needsAction')

    @property
    def photo_url(self) -> Optional[str]:
        if self.contact:
            return self.contact.photo_url
        else:
            return None

    @property
    def display_name(self) -> Optional[str]:
        if self.contact:
            return self.contact.display_name
        else:
            return self.email

    def __init__(self, email: str, responseStatus: ParticipantStatus = 'needsAction'):
        self.email = email
        self.response_status = responseStatus

    def __repr__(self):
        return f'<EventParticipant {self.id} {self.response_status}>'
