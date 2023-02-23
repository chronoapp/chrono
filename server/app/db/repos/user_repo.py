import uuid
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, Session

from app.db.models import User, Label
from .exceptions import NotFoundError


class UserRepository:
    def __init__(self, session: Session):
        self.session = session

    def getUser(self, userId: uuid.UUID) -> User:
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

    def getLabel(self, userId: uuid.UUID, labelId: Optional[uuid.UUID]) -> Optional[Label]:
        stmt = select(Label).where(Label.user_id == userId, Label.id == labelId)
        label = (self.session.execute(stmt)).scalar()

        return label

    def getLabels(self, userId: uuid.UUID) -> list[Label]:
        stmt = select(Label).where(Label.user_id == userId)
        labels = (self.session.execute(stmt)).scalars().all()

        return list(labels)

    def deleteLabel(self, userId: uuid.UUID, labelId: uuid.UUID) -> None:
        stmt = delete(Label).where(Label.user_id == userId, Label.id == labelId)
        self.session.execute(stmt)
        self.session.commit()
