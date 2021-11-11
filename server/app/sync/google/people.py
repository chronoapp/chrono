from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.db.models import Contact, User


def getPeopleService(user: User):
    credentials = Credentials(**user.credentials.token_data)
    service = build('people', 'v1', credentials=credentials, cache_discovery=False)

    return service


async def syncContacts(user: User, session: AsyncSession, fullSync: bool = False) -> None:
    """Sync contacts from Google to the DB."""
    service = getPeopleService(user)

    nextPageToken = None
    while True:
        results = (
            service.people()
            .connections()
            .list(
                resourceName='people/me',
                personFields='names,emailAddresses',
                pageToken=nextPageToken,
            )
            .execute()
        )

        connections = results.get('connections', [])
        await syncContactsToDB(user, connections, session)

        nextPageToken = results.get('nextPageToken')
        if not nextPageToken:
            break


async def syncContactsToDB(user: User, contacts, session: AsyncSession):
    for contact in contacts:
        resourceId = contact.get('resourceName')
        names = contact.get('names', [])

        defaultNameData = (
            next(n for n in names if n.get('metadata', {}).get('primary')) if names else {}
        )
        familyName = defaultNameData.get('familyName')
        givenName = defaultNameData.get('givenName')

        emails = contact.get('emailAddresses', [])
        emailAddress = emails[0].get('value') if emails else None

        stmt = select(Contact).where(Contact.user_id == user.id, Contact.google_id == resourceId)
        contact = (await session.execute(stmt)).scalar()

        if contact:
            contact.email = emailAddress
            contact.first_name = givenName
            contact.last_name = familyName
        else:
            contact = Contact(givenName, familyName, emailAddress, resourceId)
            user.contacts.append(contact)

    await session.commit()
