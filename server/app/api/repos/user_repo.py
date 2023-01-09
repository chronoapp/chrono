from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from app.db.models import User


class UserRepository:
    def __init__(self, session: Session):
        self.session = session

    def getUser(self, userId: int) -> Optional[User]:
        return (
            self.session.execute(
                select(User).where(User.id == userId).options(selectinload(User.credentials))
            )
        ).scalar()
