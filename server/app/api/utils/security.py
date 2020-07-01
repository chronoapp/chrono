import jwt
from jwt import PyJWTError

from fastapi import Depends, HTTPException, Header
from starlette.status import HTTP_403_FORBIDDEN

from app.api.utils.db import get_db
from app.db.models import User, UserCredential
from app.core import config


def get_current_user(session=Depends(get_db), authorization: str = Header(None)):
    """Gets the current user from the authorization header.
    """
    # Debug Only
    if authorization and config.DEBUG:
        username = authorization
        user = session.query(User).filter(User.username == username).first()
        if user:
            return user

    if authorization:
        try:
            tokenData = jwt.decode(authorization, config.TOKEN_SECRET, algorithm='HS256')
        except PyJWTError:
            raise HTTPException(status_code=HTTP_403_FORBIDDEN,
                                detail="Could not validate credentials")

        accessToken = tokenData.get('token')
        credentials = session.query(UserCredential).filter(
            UserCredential.token == accessToken).first()

        if credentials:
            user = credentials.user
            if user:
                return user

    raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="User not found")
