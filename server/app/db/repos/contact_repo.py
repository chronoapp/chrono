import uuid

from typing import Optional
from pydantic import BaseModel, Field, computed_field, ConfigDict
from functools import cached_property

from sqlalchemy import and_, select
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.models import User, Contact

from app.db.sql.contact_search import CONTACT_SEARCH_QUERY
from app.db.repos.event_repo.view_models import EventParticipantVM


class ContactRepoError(Exception):
    """Base class for exceptions in this module."""

    pass


class ContactVM(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    first_name: Optional[str] = Field(alias="firstName", default=None)
    last_name: Optional[str] = Field(alias="lastName", default=None)
    email: Optional[str] = None
    photo_url: Optional[str] = Field(alias="photoUrl", default=None)
    google_id: Optional[str] = Field(alias="googleId", default=None)

    @computed_field(alias='displayName', repr=False)  # type: ignore[misc]
    @cached_property
    def display_name(self) -> str | None:
        if self.first_name and self.last_name:
            return f'{self.first_name} {self.last_name}'
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email


class ContactInDBVM(ContactVM):
    id: uuid.UUID


class ContactRepository:
    def __init__(self, session: Session):
        self.session = session

    def searchContacts(self, user: User, query: str, limit: int = 10) -> list[Contact]:
        tsQuery = ' | '.join(query.split())
        rows = self.session.execute(
            text(CONTACT_SEARCH_QUERY), {'userId': user.id, 'query': tsQuery, 'limit': limit}
        )
        rowIds = [r[0] for r in rows]

        stmt = select(Contact).filter(Contact.id.in_(rowIds))
        result = self.session.execute(stmt)
        contacts = result.scalars().all()

        return list(contacts)

    def addContact(self, user: User, contactVM: ContactVM) -> Contact:
        contact = Contact(
            contactVM.first_name,
            contactVM.last_name,
            contactVM.email,
            contactVM.photo_url,
            contactVM.google_id,
        )
        user.contacts.append(contact)

        return contact

    def getContacts(self, user: User, limit: int = 10) -> list[Contact]:
        result = self.session.execute(
            select(Contact).where(Contact.user_id == user.id).limit(limit)
        )

        contacts = result.scalars().all()

        return list(contacts)

    def findContact(self, user: User, participantVM: EventParticipantVM) -> Optional[Contact]:
        existingContact = None

        if participantVM.contact_id:
            existingContact = self.getContact(user, participantVM.contact_id)
            if not existingContact:
                raise ContactRepoError('Invalid Participant.')
        elif participantVM.email:
            existingContact = self.getContactWithEmail(user, participantVM.email)

        return existingContact

    def getContact(self, user: User, contactId: uuid.UUID) -> Optional[Contact]:
        return (
            self.session.execute(
                select(Contact).where(and_(Contact.user_id == user.id, Contact.id == contactId))
            )
        ).scalar()

    def getContactWithEmail(self, user: User, email: str) -> Optional[Contact]:
        return (
            self.session.execute(
                select(Contact).where(and_(Contact.user_id == user.id, Contact.email == email))
            )
        ).scalar()
