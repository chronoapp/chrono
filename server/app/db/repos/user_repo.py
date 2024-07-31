import uuid
from typing import Optional, Sequence

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, Session

from app.db.models import User, Label, UserAccount
from .exceptions import NotFoundError


class UserRepository:
    def __init__(self, session: Session):
        self.session = session

    def getAllUsers(self) -> Sequence[User]:
        users = (
            self.session.execute(select(User).options(selectinload(User.accounts)))
            .unique()
            .scalars()
            .all()
        )

        return users

    def getUser(self, userId: uuid.UUID) -> User:
        user = (
            self.session.execute(
                select(User).where(User.id == userId).options(selectinload(User.accounts))
            )
        ).scalar()

        if user:
            return user
        else:
            raise NotFoundError('User not found.')

    def getUserAccount(self, accountId: uuid.UUID) -> UserAccount:
        account = (
            self.session.execute(select(UserAccount).join(User).where(UserAccount.id == accountId))
        ).scalar()

        if account:
            return account
        else:
            raise NotFoundError('Account not found.')

    def getUserByEmail(self, email: str) -> Optional[User]:
        user = (
            self.session.execute(
                select(User).where(User.email == email).options(selectinload(User.accounts))
            )
        ).scalar()

        return user

    def deleteUser(self, userId: uuid.UUID) -> None:
        user = self.getUser(userId)
        self.session.delete(user)

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
