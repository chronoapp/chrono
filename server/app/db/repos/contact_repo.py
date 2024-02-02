import uuid
from datetime import datetime

from typing import Optional
from pydantic import BaseModel, Field, computed_field, ConfigDict
from functools import cached_property

from sqlalchemy.orm import Session
from sqlalchemy import text, select

from app.db.models import Contact, UserAccount, User

from app.db.sql.contact_search import CONTACT_SEARCH_QUERY
from app.db.repos.event_repo.view_models import EventParticipantVM
from app.db.sql.contacts_in_events import CONTACT_IN_EVENTS_QUERY


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


class ContactInEventVM(BaseModel):
    """Represents a contact that has been in an event with the user."""

    total_time_spent_in_seconds: int | None
    last_seen: datetime | None
    contact: ContactInDBVM


class ContactRepository:
    def __init__(self, user: User, session: Session):
        self.user = user
        self.session = session

    def searchContacts(self, query: str, limit: int = 10) -> list[Contact]:
        """Search for all user contacts that match the query."""
        tsQuery = ' | '.join(query.split())
        rows = self.session.execute(
            text(CONTACT_SEARCH_QUERY),
            {'userId': self.user.id, 'query': tsQuery, 'limit': limit},
        )
        rowIds = [r[0] for r in rows]

        stmt = select(Contact).filter(Contact.id.in_(rowIds))
        result = self.session.execute(stmt)
        contacts = result.scalars().all()

        return list(contacts)

    def getContacts(self, limit: int = 10) -> list[Contact]:
        """Gets all contacts for the user."""
        result = self.session.execute(
            select(Contact)
            .join(UserAccount)
            .where(UserAccount.user_id == self.user.id)
            .limit(limit)
        )

        contacts = result.scalars().all()

        return list(contacts)

    def addContact(self, account: UserAccount, contactVM: ContactVM) -> Contact:
        """Adds a new contact to the user's account."""
        contact = Contact(
            contactVM.first_name,
            contactVM.last_name,
            contactVM.email,
            contactVM.photo_url,
            contactVM.google_id,
        )
        contact.account = account
        contact.user = self.user
        self.session.add(contact)

        return contact

    def findContact(self, participantVM: EventParticipantVM) -> Optional[Contact]:
        existingContact = None

        if participantVM.contact_id:
            existingContact = self.getContact(participantVM.contact_id)
            if not existingContact:
                raise ContactRepoError('Invalid Participant.')
        elif participantVM.email:
            existingContact = self.getContactWithEmail(participantVM.email)

        return existingContact

    def getContact(self, contactId: uuid.UUID) -> Optional[Contact]:
        return (
            self.session.execute(
                select(Contact)
                .join(UserAccount)
                .where(UserAccount.user_id == self.user.id, Contact.id == contactId)
            )
        ).scalar()

    def getGoogleContact(self, googleId: str) -> Optional[Contact]:
        return (self.session.execute(select(Contact).where(Contact.google_id == googleId))).scalar()

    def getContactWithEmail(self, email: str) -> Optional[Contact]:
        return (
            self.session.execute(
                select(Contact)
                .join(UserAccount)
                .where(UserAccount.user_id == self.user.id, Contact.email == email)
            )
        ).scalar()

    def getContactsInEvents(
        self, startTime: datetime, endDateTime: datetime, limit: int = 50
    ) -> list[ContactInEventVM]:
        rows = self.session.execute(
            text(CONTACT_IN_EVENTS_QUERY),
            {
                'userId': self.user.id,
                'startDateTime': startTime,
                'endDateTime': endDateTime,
                'limit': limit,
            },
        )

        return [
            ContactInEventVM(
                total_time_spent_in_seconds=row.total_time_spent_in_seconds,
                last_seen=row.last_seen,
                contact=ContactInDBVM(
                    id=row.id,
                    firstName=row.first_name,
                    lastName=row.last_name,
                    email=row.email,
                    photoUrl=row.photo_url,
                    googleId=row.google_id,
                ),
            )
            for row in rows
        ]
