import requests
import uuid
from pydantic import BaseModel
import secrets
import string
from sqlalchemy.orm import Session

from fastapi import Depends, status, HTTPException, APIRouter
from fastapi.responses import RedirectResponse, HTMLResponse
from urllib.parse import urlencode
from jinja2 import Environment, PackageLoader

from app.core import config
from app.utils.redis import getRedisConnection
from app.api.utils.db import get_db
from app.db.repos.user_repo import UserRepository
from app.db.models import ZoomConnection

router = APIRouter()


class ZoomAuthData(BaseModel):
    access_token: str
    refresh_token: str
    scope: str
    expires_in: int
    token_type: str


class AuthData(BaseModel):
    code: str


REDIRECT_URL = f'{config.API_URL}/oauth/zoom/callback'

Template = Environment(loader=PackageLoader('app', 'templates'))


@router.get('/oauth/zoom/auth')
def zoomAuth(user_id: uuid.UUID):
    """Redirects to zoom oauth consent screen.
    https://developers.zoom.us/docs/integrations/oauth/
    """

    code = _generateCode(32)
    authorization_url = _getAuthenticationUrl(code)
    response = RedirectResponse(url=authorization_url)

    _initOAuthUser(code, user_id)

    return response


@router.get('/oauth/zoom/callback')
def zoom_callback(state: str, code: str, session: Session = Depends(get_db)):
    userId = _getOAuthUser(state)

    if not userId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid User')

    userRepo = UserRepository(session)
    user = userRepo.getUser(userId)

    zoomInfo = _getZoomInfo(code)
    email = _getEmail(zoomInfo.access_token)

    if not user.zoom_connection:
        user.zoom_connection = ZoomConnection(
            zoomInfo.access_token, zoomInfo.refresh_token, zoomInfo.scope, email
        )
        session.add(user.zoom_connection)
    else:
        user.zoom_connection.access_token = zoomInfo.access_token
        user.zoom_connection.refresh_token = zoomInfo.refresh_token
        user.zoom_connection.scope = zoomInfo.scope
        user.zoom_connection.email = email

    session.add(user)
    session.commit()

    return HTMLResponse(
        content=Template.get_template('oauth/zoom_complete.html').render(APP_URL=config.APP_URL)
    )


def _getZoomInfo(code):
    clientAuth = requests.auth.HTTPBasicAuth(config.ZOOM_CLIENT_ID, config.ZOOM_CLIENT_SECRET)

    response = requests.post(
        "https://zoom.us/oauth/token",
        auth=clientAuth,
        data={"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URL},
    )
    token_json = response.json()

    return ZoomAuthData(**token_json)


def _getEmail(access_token: str):
    headers = {"Authorization": "bearer " + access_token}
    response = requests.get("https://api.zoom.us/v2/users/me", headers=headers)
    meJson = response.json()

    return meJson['email']


def _getAuthenticationUrl(code: str):
    """The url for the user to authenticate with Zoom."""

    params = {
        "client_id": config.ZOOM_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URL,
        "state": code,
    }

    url = "https://zoom.us/oauth/authorize?" + urlencode(params)

    return url


def _initOAuthUser(state: str, userId: uuid.UUID):
    """Stores Zoom Oauth state, which links the request and the callback."""

    redisClient = getRedisConnection()
    redisClient.setex(f"zoom_oauth:state:{state}", 600, str(userId))


def _getOAuthUser(state: str | None):
    """Retrieves the user ID from the state."""
    if not state:
        return None

    redisClient = getRedisConnection()
    oauthState = redisClient.get(f"zoom_oauth:state:{state}")
    if not oauthState:
        return None
    else:
        return oauthState.decode('utf-8')


def _generateCode(length):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
