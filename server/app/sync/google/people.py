from sqlalchemy import select
from sqlalchemy.orm import Session

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.db.models import Contact, User


def syncContacts(user: User, session: Session, fullSync: bool = False) -> None:
    """Sync contacts from Google to the DB."""
    service = _getPeopleService(user)

    syncOtherContacts(service, user, session)
    syncConnections(service, user, session)


def syncOtherContacts(service, user: User, session: Session):
    nextPageToken = None
    while True:
        results = (
            service.otherContacts()
            .list(
                readMask='names,emailAddresses,photos',
                pageToken=nextPageToken,
            )
            .execute()
        )

        contacts = results.get('otherContacts', [])
        syncContactsToDB(user, contacts, session)

        nextPageToken = results.get('nextPageToken')
        if not nextPageToken:
            break


def syncConnections(service, user: User, session: Session):
    nextPageToken = None
    while True:
        results = (
            service.people()
            .connections()
            .list(
                resourceName='people/me',
                personFields='names,emailAddresses,photos',
                pageToken=nextPageToken,
            )
            .execute()
        )

        connections = results.get('connections', [])
        syncContactsToDB(user, connections, session)

        nextPageToken = results.get('nextPageToken')
        if not nextPageToken:
            break


def syncContactsToDB(user: User, contacts, session: Session):
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

        photos = contact.get('photos', [])
        photoUrl = photos[0].get('url') if len(photos) > 0 else None

        stmt = select(Contact).where(Contact.user_id == user.id, Contact.google_id == resourceId)
        contact = (session.execute(stmt)).scalar()

        if contact:
            contact.email = emailAddress
            contact.first_name = givenName
            contact.last_name = familyName
            contact.photo_url = photoUrl
        else:
            contact = Contact(givenName, familyName, emailAddress, photoUrl, resourceId)
            user.contacts.append(contact)

    session.commit()


def _getPeopleService(user: User):
    """Get the Google People API service for the user's default account.
    TODO: Handle multiple accounts.
    """
    tokenData = user.getDefaultAccount().token_data

    credentials = Credentials(**tokenData)
    service = build('people', 'v1', credentials=credentials, cache_discovery=False)

    return service
