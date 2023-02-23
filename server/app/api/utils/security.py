import jwt
import uuid

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from app.api.utils.db import get_db
from app.db.models import User
from app.db.repos.user_repo import UserRepository
from app.core import config


def get_current_user(session: Session = Depends(get_db), authorization: str = Header(None)) -> User:
    """Gets the current user from the authorization header."""
    userRepo = UserRepository(session)

    # Debug Only
    if authorization and config.DEBUG:
        email = authorization
        if user := userRepo.getUserByEmail(email):
            return user

    if authorization:
        try:
            tokenData = jwt.decode(authorization, config.TOKEN_SECRET, algorithms=['HS256'])
            userId = tokenData.get('user_id')

            if userId:
                if user := userRepo.getUser(uuid.UUID(userId)):
                    return user

        except (ValueError, jwt.PyJWTError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
            )

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")
