import logging
import jwt
from typing import Tuple
from datetime import datetime

from requests_oauthlib import OAuth2Session
from fastapi import Depends, Request, APIRouter
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core import config
from app.db.repos.user_repo import UserRepository
from app.db.models.user_account import UserAccount, CalendarProvider
from app.db.models.user import User
from app.api.utils.db import get_db
from app.sync.msft.calendar import getMsftUser, getMsftSettings
from .token_utils import getAuthToken

router = APIRouter()

""" Microsoft Graph OAuth2"""


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

    userRepo = UserRepository(session)
    user = userRepo.getUserByEmail(email)

    if not user:
        user = User(email, name, None)
        session.add(user)
    else:
        user.email = email
        user.name = name

    existingAccount = user.getAccount(CalendarProvider.Microsoft, email)
    if not existingAccount:
        user.accounts.append(UserAccount(email, tokenResult, CalendarProvider.Microsoft))

    session.commit()

    authToken = getAuthToken(user)

    response = RedirectResponse(config.APP_URL)
    response.set_cookie(key='auth_token', value=authToken)

    return response
