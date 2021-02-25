import jwt
from sqlalchemy import select
from fastapi import Depends, HTTPException, Header, status

from app.api.utils.db import get_db
from app.db.models import User, UserCredential
from app.core import config


def get_current_user(session=Depends(get_db), authorization: str = Header(None)) -> User:
    """Gets the current user from the authorization header."""
    # Debug Only
    if authorization and config.DEBUG:
        email = authorization
        if (user := session.execute(select(User).where(User.email == email)).scalar()) :
            return user

    elif authorization:
        try:
            tokenData = jwt.decode(authorization, config.TOKEN_SECRET, algorithms=['HS256'])
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
            )

        userId = tokenData.get('user_id')
        if (user := session.execute(select(User).where(User.id == userId)).scalar()) :
            return user

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")
