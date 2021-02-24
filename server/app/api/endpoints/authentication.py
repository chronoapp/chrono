import logging
import jwt
import requests

from typing import Tuple
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from datetime import datetime
from urllib.parse import unquote
from requests_oauthlib import OAuth2Session
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials

from sqlalchemy.orm import Session

from app.core import config
from app.db.models.user_credentials import UserCredential, ProviderType
from app.db.models.user import User
from app.api.utils.db import get_db
from app.calendar.microsoft import getMsftUser, getMsftSettings

router = APIRouter()

# ================================== Google OAuth2 ==================================


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

    scopes = ['https://www.googleapis.com/auth/calendar']
    flow = getAuthFlow(scopes)
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

        token = flow.credentials.token
        resp = requests.get(f'https://www.googleapis.com/oauth2/v2/userinfo?access_token={token}')
        userInfo = resp.json()
        email = userInfo.get('email')
        name = userInfo.get('given_name')
        pictureUrl = userInfo.get('picture')
        logging.info(userInfo)

        user = session.query(User).filter(User.email == email).first()
        if not user:
            user = User(email, name, pictureUrl)
            session.add(user)
        else:
            user.email = email
            user.name = name
            user.picture_url = pictureUrl

        creds = getCredentialsDict(flow.credentials)
        user.credentials = UserCredential(creds, ProviderType.Google)
        session.commit()

        authToken = getAuthToken(user)
        return {'token': authToken}

    except Exception as e:
        logging.error(e)


def getAuthToken(user: User) -> str:
    return str(
        jwt.encode(
            {'user_id': user.id, 'iat': datetime.utcnow()}, config.TOKEN_SECRET, algorithm='HS256'
        )
    )


# ================================== Microsoft Graph OAuth2 ==================================


def getMsftSignInUrl() -> Tuple[str, str]:
    """Generates a sign in url for microsoft."""
    settings = getMsftSettings()

    # Initialize the OAuth client
    session = OAuth2Session(
        settings['app_id'], scope=settings['scopes'], redirect_uri=settings['redirect']
    )

    authorizeUrl = '{0}{1}'.format(settings['authority'], settings['authorize_endpoint'])
    signInUrl, state = session.authorization_url(authorizeUrl, prompt='login')

    return signInUrl, state


@router.get('/oauth/msft/auth')
def msftAuth():
    url, state = getMsftSignInUrl()

    response = RedirectResponse(url)
    response.set_cookie(key='auth_state', value=state)
    logging.info(f'Set State: {state}')

    return response


@router.get('/oauth/msft/callback')
def msftCallback(request: Request, session: Session = Depends(get_db)):
    expectedState = request.cookies.get('auth_state')
    settings = getMsftSettings()
    callbackUrl = f'{request.url.path}?{request.query_params}'

    # 1) Get token from code.
    oauth = OAuth2Session(
        settings['app_id'],
        state=expectedState,
        scope=settings['scopes'],
        redirect_uri=settings['redirect'],
    )

    tokenUrl = '{0}{1}'.format(settings['authority'], settings['token_endpoint'])
    tokenResult = oauth.fetch_token(
        tokenUrl, client_secret=settings['app_secret'], authorization_response=callbackUrl
    )

    userJson = getMsftUser(tokenResult)
    email = userJson.get('mail')
    name = userJson.get('displayName')

    user = session.query(User).filter(User.email == email).first()
    if not user:
        user = User(email, name, None)
        session.add(user)
    else:
        user.email = email
        user.name = name

    user.credentials = UserCredential(tokenResult, ProviderType.Microsoft)
    session.commit()

    authToken = str(
        jwt.encode(
            {'user_id': user.id, 'iat': datetime.utcnow()}, config.TOKEN_SECRET, algorithm='HS256'
        )
    )

    response = RedirectResponse(config.APP_URL)
    response.set_cookie(key='auth_token', value=authToken)

    return response
