import uuid
from typing import Literal
from sqlalchemy.orm import Session
from pydantic import BaseModel
from urllib.parse import unquote

from fastapi import Depends, status, HTTPException, APIRouter
from fastapi.responses import RedirectResponse, HTMLResponse
from jinja2 import Environment, PackageLoader

from oauthlib.oauth2.rfc6749.errors import InvalidGrantError
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials

from .token_utils import getAuthToken

from app.db.repos.user_repo import UserRepository
from app.db.models.user_account import UserAccount, CalendarProvider
from app.db.models.user import User
from app.api.utils.db import get_db

from app.core import config
from app.core.logger import logger
from app.utils.redis import getRedisConnection
from app.sync.google.tasks import syncAllCalendarsTask
from app.core.notifications import sendClientNotification, NotificationType

"""Connect Google accounts with OAuth2

We make the distinction between signing up with a new Google Account,
and adding a new Google Account to an existing user.

Sign Up: Redirects to the frontend, which makes a request to /oauth/google/token
to get the auth token, saves it to localStorage.

Add Account: opens a new tab and redirects back to /oauth/google/auth/callback with the auth code.
"""

router = APIRouter()


GOOGLE_API_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts.other.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
]

CREDENTIALS = {
    "web": {
        "client_id": config.GOOGLE_CLIENT_ID,
        "project_id": config.GOOGLE_PROJECT_ID,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": config.GOOGLE_CLIENT_SECRET,
    }
}


class AuthData(BaseModel):
    code: str


AuthType = Literal['sign_in', 'add_account']

SignedOutUser = 'SIGNED_OUT_USER'

Template = Environment(loader=PackageLoader('app', 'templates'))


@router.get('/oauth/google/auth')
def googleAuth(auth_type: AuthType = 'sign_in', user_id: uuid.UUID | None = None):
    """Redirects to google oauth consent screen.
    https://developers.google.com/identity/protocols/OAuth2WebServer
    """
    flow = _getOauthFlow(auth_type)
    authorization_url, state = flow.authorization_url(
        access_type='offline', prompt='consent', include_granted_scopes='true'
    )

    _initOAuthState(state, user_id)

    response = RedirectResponse(url=unquote(authorization_url))
    response.set_cookie(key='auth_state', value=state)

    return response


@router.get('/oauth/google/add-account-callback')
def addAccountCallback(state: str, code: str, session: Session = Depends(get_db)):
    """Callback for add account flow to connect a new account"""
    flow = _getOauthFlow('add_account')
    flow.fetch_token(code=code)

    oauthState = _getOAuthState(state)
    if not oauthState:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid oauth state.')

    userId = uuid.UUID(oauthState) if oauthState != SignedOutUser else None
    if not userId:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid oauth state.')

    googleSession = flow.authorized_session()
    userInfo = googleSession.get('https://www.googleapis.com/userinfo/v2/me').json()
    email = userInfo.get('email')

    userRepo = UserRepository(session)
    user = userRepo.getUser(userId)

    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'User not found.')

    creds = _getCredentialsDict(flow.credentials)

    account = user.getAccount(CalendarProvider.Google, email)
    if not account:
        account = UserAccount(email, creds, CalendarProvider.Google, False)
        user.accounts.append(account)

    session.commit()

    # Send a notification to the frontend to refresh the user's accounts.
    sendClientNotification(str(user.id), NotificationType.REFRESH_USER)

    # Start syncing calendar after adding account.
    syncAllCalendarsTask.send(account.id, False)

    return HTMLResponse(
        content=Template.get_template('oauth/google_complete.html').render(APP_URL=config.APP_URL)
    )


@router.post('/oauth/google/token')
def googleAuthToken(authData: AuthData, session: Session = Depends(get_db)):
    """After Oauth is successful for signing up or signing in, exchange it for an auth token."""
    flow = Flow.from_client_config(CREDENTIALS, scopes=GOOGLE_API_SCOPES)
    flow.redirect_uri = config.APP_URL + '/auth'

    try:
        flow.fetch_token(code=authData.code)
    except InvalidGrantError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, 'Invalid oauth grant details.')

    googleSession = flow.authorized_session()
    userInfo = googleSession.get('https://www.googleapis.com/userinfo/v2/me').json()

    email = userInfo.get('email')
    name = userInfo.get('given_name')
    pictureUrl = userInfo.get('picture')

    userRepo = UserRepository(session)
    user = userRepo.getUserByEmail(email)

    if not user:
        user = User(email, name, pictureUrl)
        session.add(user)

    creds = _getCredentialsDict(flow.credentials)

    existingAccount = user.getAccount(CalendarProvider.Google, email)
    if not existingAccount:
        user.accounts.append(UserAccount(email, creds, CalendarProvider.Google))

    session.commit()

    authToken = getAuthToken(user)

    return {'token': authToken}


def _getOauthFlow(auth_type: AuthType):
    flow = Flow.from_client_config(CREDENTIALS, scopes=GOOGLE_API_SCOPES)

    if auth_type == 'sign_in':
        flow.redirect_uri = config.APP_URL + '/auth'
    elif auth_type == 'add_account':
        flow.redirect_uri = config.API_URL + '/oauth/google/add-account-callback'
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Invalid auth type.')

    return flow


def _getCredentialsDict(credentials: Credentials):
    return {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes,
    }


def _initOAuthState(state: str, userId: uuid.UUID | None):
    """Stores Google Oauth state, which links the request and the callback."""
    redisClient = getRedisConnection()

    if not userId:
        redisClient.setex(f"google_oauth:state:{state}", 600, SignedOutUser)
    else:
        redisClient.setex(f"google_oauth:state:{state}", 600, str(userId))


def _getOAuthState(state: str):
    """Retrieves the user ID from the state."""
    redisClient = getRedisConnection()

    oauthState = redisClient.get(f"google_oauth:state:{state}")
    if not oauthState:
        return None
    else:
        return oauthState.decode('utf-8')
