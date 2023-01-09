import jwt
from fastapi import Depends, HTTPException, Header, status

from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from app.api.utils.db import get_db
from app.db.models import User, UserCredential
from app.core import config


def get_current_user(session: Session = Depends(get_db), authorization: str = Header(None)) -> User:
    """Gets the current user from the authorization header."""
    # Debug Only
    if authorization and config.DEBUG:
        email = authorization
        res = session.execute(
            select(User).where(User.email == email).options(selectinload(User.credentials))
        )
        if user := res.scalar():
            return user

    if authorization:
        try:
            tokenData = jwt.decode(authorization, config.TOKEN_SECRET, algorithms=['HS256'])
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
            )

        userId = tokenData.get('user_id')
        res = session.execute(
            select(User).where(User.id == userId).options(selectinload(User.credentials))
        )
        if user := res.scalar():
            return user

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")
