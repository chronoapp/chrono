from pydantic import BaseModel
import bcrypt

from sqlalchemy.orm import Session
from fastapi import Depends, status, HTTPException, APIRouter


from app.db.repos.user_repo import UserRepository
from app.db.models.user import User
from app.api.utils.db import get_db
from .token_utils import getAuthToken


router = APIRouter()


class LoginUser(BaseModel):
    email: str
    password: str


def verifyPassword(plainPass: str, hashedPass: str) -> bool:
    return bcrypt.checkpw(plainPass.encode('utf-8'), hashedPass.encode('utf-8'))


def getPasswordHash(plainPass: str) -> str:
    return bcrypt.hashpw(plainPass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def authenticateUser(loginUser: LoginUser, session: Session) -> User:
    userRepo = UserRepository(session)
    user = userRepo.getUserByEmail(loginUser.email)

    if not user or not user.hashed_password:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail='User and password combination does not exist.'
        )

    if not verifyPassword(loginUser.password, user.hashed_password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail='User and password combination does not exist.'
        )

    return user


@router.post('/auth/login')
def login(loginUser: LoginUser, session: Session = Depends(get_db)):
    user = authenticateUser(loginUser, session)
    authToken = getAuthToken(user)

    return {'token': authToken}
