from sqlalchemy.orm import Session

from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError
from googleapiclient.discovery import build

from app.db.repos.contact_repo import ContactRepository
from app.db.models import Contact, User, UserAccount
from app.core.logger import logger


def syncContacts(user: User, session: Session, fullSync: bool = False) -> None:
    """Sync contacts from Google to the DB."""

    for account in user.accounts:
        try:
            connections = _getConnections(account)
            _syncContactsToDB(user, connections, session)

            otherContacts = _getOtherContacts(account)
            _syncContactsToDB(user, otherContacts, session)

        except HttpError as e:
            logger.error(f'Error getting connections for {account}', e)


def _syncContactsToDB(user: User, contacts, session: Session):
    contactRepo = ContactRepository(user, session)

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

        contact = contactRepo.getGoogleContact(resourceId)

        if contact:
            contact.email = emailAddress
            contact.first_name = givenName
            contact.last_name = familyName
            contact.photo_url = photoUrl
        else:
            contact = Contact(givenName, familyName, emailAddress, photoUrl, resourceId)
            user.contacts.append(contact)

    session.commit()


def _getConnections(account: UserAccount):
    """Get all connections from Google."""
    service = _getPeopleService(account)
    allConnections = []

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
        allConnections.extend(connections)

        nextPageToken = results.get('nextPageToken')
        if not nextPageToken:
            break

    return allConnections


def _getOtherContacts(account: UserAccount):
    service = _getPeopleService(account)
    allContacts = []

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
        allContacts.extend(contacts)

        nextPageToken = results.get('nextPageToken')
        if not nextPageToken:
            break

    return allContacts


def _getPeopleService(account: UserAccount):
    """Get the Google People API service for the user's default account.
    TODO: Handle multiple accounts.
    """
    tokenData = account.token_data

    credentials = Credentials(**tokenData)
    service = build('people', 'v1', credentials=credentials, cache_discovery=False)

    return service
