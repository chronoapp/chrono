from typing import Optional, Literal
import shortuuid

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship, backref

from app.db.base_class import Base


ResponseStatus = Literal['needsAction', 'accepted', 'declined', 'tentative']


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
    response_status = Column(String(255), nullable=False, default='needsAction')

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

    def __init__(
        self,
        email: Optional[str],
        displayName: Optional[str],
        contactId: Optional[str],
        responseStatus: ResponseStatus = 'needsAction',
    ):
        self.email_ = email
        self.display_name_ = displayName
        self.contact_id = contactId
        self.response_status = responseStatus

    def __repr__(self):
        return f'<EventParticipant {self.email_} {self.display_name} {self.response_status}>'
