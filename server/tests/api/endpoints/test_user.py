import uuid

from app.db.models import User, UserAccount, CalendarProvider, Calendar, UserCalendar
from app.api.endpoints.authentication.token_utils import getAuthToken

from app.db.repos.contact_repo import ContactRepository, ContactVM
from app.db.repos.calendar_repo import CalendarRepository


def test_user_delete_account(user: User, session, test_client):
    """Ensure that we can delete a user's connected account.
    Referenced calendars should also be deleted.
    """
    calRepo = CalendarRepository(session)

    # 1) Create a new account.

    account = UserAccount('new-account@rechrono.com', {}, CalendarProvider.Google)
    user.accounts.append(account)

    # 2) Attach a calendar to the account.

    calendarId = uuid.uuid4()
    calendar = Calendar(
        calendarId, 'new-cal', 'description', 'America/Toronto', 'new-account@rechrono.com'
    )
    userCalendar = UserCalendar(
        calendarId, None, '#ffffff', '#000000', True, 'owner', True, False, []
    )

    userCalendar.calendar = calendar
    userCalendar.account = account

    session.add(userCalendar)
    session.commit()

    assert len(calRepo.getCalendars(user)) == 2

    # 3) Attach contacts to the calendar.

    contactRepo = ContactRepository(user, session)
    contactRepo.addContact(
        account, contactVM=ContactVM(firstName='Jim', lastName='Row', email='user@rechrono.com')
    )

    assert len(contactRepo.getContacts()) == 1

    # 4) Delete the account.

    token = getAuthToken(user)
    resp = test_client.delete(
        f'/api/v1/user/accounts/{account.id}', headers={'Authorization': token}
    )

    # Ensure that the calendar and contacts are deleted.
    assert resp.status_code == 204
    assert len(contactRepo.getContacts()) == 0
    assert len(calRepo.getCalendars(user)) == 1
