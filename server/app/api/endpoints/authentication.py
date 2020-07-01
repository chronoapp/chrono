import logging
import jwt
import requests
from urllib.parse import unquote

from google_auth_oauthlib.flow import Flow
from pydantic import BaseModel

from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends
from starlette.responses import RedirectResponse
from app.core import config
from app.db.models import UserCredential, User
from app.api.utils.db import get_db

router = APIRouter()


class AuthData(BaseModel):
    code: str


def getAuthFlow(scopes):
    credentials = {
        "web": {
            "client_id":
            config.GOOGLE_CLIENT_ID,
            "project_id":
            config.PROJECT_ID,
            "auth_uri":
            "https://accounts.google.com/o/oauth2/auth",
            "token_uri":
            "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url":
            "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret":
            config.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [
                "https://test.timecouncil.com/oauth/callback",
                "https://api.timecouncil.com/oauth/callback", 'http://localhost:3000/auth'
            ],
            "javascript_origins": ["https://test.timecouncil.com"]
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
    authorization_url, state = flow.authorization_url(access_type='offline',
                                                      prompt='consent',
                                                      include_granted_scopes='true')

    return RedirectResponse(url=unquote(authorization_url))


@router.post('/oauth/google/token')
def googleAuthCallback(authData: AuthData, session: Session = Depends(get_db)):
    try:
        authCode = authData.code

        flow = getAuthFlow(None)
        flow.fetch_token(code=authCode)

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

        credentials = UserCredential(flow.credentials)
        user.credentials = credentials
        session.commit()

        authToken = jwt.encode({
            'token': token
        }, config.TOKEN_SECRET, algorithm='HS256').decode('utf-8')

        return {'token': str(authToken)}

    except Exception as e:
        logging.error(e)
