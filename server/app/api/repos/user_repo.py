from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from app.db.models import User
from .exceptions import NotFoundError


class UserRepository:
    def __init__(self, session: Session):
        self.session = session

    def getUser(self, userId: int) -> User:
        user = (
            self.session.execute(
                select(User).where(User.id == userId).options(selectinload(User.credentials))
            )
        ).scalar()

        if user:
            return user
        else:
            raise NotFoundError('User not found.')

    def getUserByEmail(self, email: str) -> Optional[User]:
        user = (
            self.session.execute(
                select(User).where(User.email == email).options(selectinload(User.credentials))
            )
        ).scalar()

        return user
