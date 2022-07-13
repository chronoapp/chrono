from typing import Optional, List
from pydantic import BaseModel

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.models import User, Contact
from app.db.sql.contact_search import CONTACT_SEARCH_QUERY
from app.api.repos.event_utils import EventParticipantVM


class ContactRepoError(Exception):
    """Base class for exceptions in this module."""

    pass


class ContactVM(BaseModel):
    first_name: Optional[str]
    last_name: Optional[str]
    email: str
    photo_url: Optional[str]
    google_id: Optional[str]


class ContactRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def searchContacts(self, user: User, query: str, limit: int = 10) -> List[Contact]:
        rows = await self.session.execute(
            text(CONTACT_SEARCH_QUERY), {'userId': user.id, 'query': query, 'limit': limit}
        )
        rowIds = [r[0] for r in rows]

        stmt = select(Contact).filter(Contact.id.in_(rowIds))
        result = await self.session.execute(stmt)

        return result.scalars().all()

    async def addContact(self, user: User, contactVM: ContactVM) -> List[Contact]:
        contact = Contact(
            contactVM.first_name,
            contactVM.last_name,
            contactVM.email,
            contactVM.photo_url,
            contactVM.google_id,
        )
        user.contacts.append(contact)

        return contact

    async def getContacts(self, user: User, limit: int = 10) -> List[Contact]:
        result = await self.session.execute(
            select(Contact).where(Contact.user_id == user.id).limit(limit)
        )

        return result.scalars().all()

    async def findContact(self, user: User, participantVM: EventParticipantVM) -> Optional[Contact]:
        existingContact = None

        if participantVM.contact_id:
            existingContact = await self.getContact(user, participantVM.contact_id)
            if not existingContact:
                raise ContactRepoError('Invalid Participant.')
        elif participantVM.email:
            existingContact = await self.getContactWithEmail(user, participantVM.email)

        return existingContact

    async def getContact(self, user: User, contactId: str) -> Optional[Contact]:
        return (
            await self.session.execute(
                select(Contact).where(and_(Contact.user_id == user.id, Contact.id == contactId))
            )
        ).scalar()

    async def getContactWithEmail(self, user: User, email: str) -> Optional[Contact]:
        return (
            await self.session.execute(
                select(Contact).where(and_(Contact.user_id == user.id, Contact.email == email))
            )
        ).scalar()
