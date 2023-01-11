import jwt

from pydantic import BaseModel
from fastapi import Depends, status, HTTPException, APIRouter
from fastapi.responses import RedirectResponse
from oauthlib.oauth2.rfc6749.errors import InvalidGrantError

from datetime import datetime
from urllib.parse import unquote
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials

from sqlalchemy.orm import Session

from app.core import config
from app.api.repos.user_repo import UserRepository
from app.db.models.user_credentials import UserCredential, ProviderType
from app.db.models.user import User
from app.api.utils.db import get_db
from .token_utils import getAuthToken

"""Google OAuth2"""

router = APIRouter()


GOOGLE_API_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts.other.readonly',
    'openid',
]


class AuthData(BaseModel):
    code: str


def getCredentialsDict(credentials: Credentials):
    return {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes,
    }


def getAuthFlow(scopes):
    credentials = {
        "web": {
            "client_id": config.GOOGLE_CLIENT_ID,
            "project_id": config.PROJECT_ID,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [
                "https://test.timecouncil.com/oauth/callback",
                "https://api.timecouncil.com/oauth/callback",
                'http://localhost:3000/auth',
            ],
            "javascript_origins": ["https://test.timecouncil.com"],
        }
    }
    flow = Flow.from_client_config(credentials, scopes=scopes)
    flow.redirect_uri = config.APP_URL + '/auth'

    return flow


@router.get('/oauth/google/auth')
def googleAuth():
    """Redirects to google oauth consent screen.
    https://developers.google.com/identity/protocols/OAuth2WebServer
    """
    flow = getAuthFlow(GOOGLE_API_SCOPES)
    authorization_url, state = flow.authorization_url(
        access_type='offline', prompt='consent', include_granted_scopes='true'
    )

    response = RedirectResponse(url=unquote(authorization_url))
    response.set_cookie(key='auth_state', value=state)

    return response


@router.post('/oauth/google/token')
def googleAuthCallback(authData: AuthData, session: Session = Depends(get_db)):
    try:
        flow = getAuthFlow(None)
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
    else:
        user.email = email
        user.name = name
        user.picture_url = pictureUrl

    creds = getCredentialsDict(flow.credentials)

    user.credentials = UserCredential(creds, ProviderType(ProviderType.Google))
    session.commit()

    authToken = getAuthToken(user)

    return {'token': authToken}
