from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def getUser(self, userId: int) -> Optional[User]:
        return (
            await self.session.execute(
                select(User).where(User.id == userId).options(selectinload(User.credentials))
            )
        ).scalar()
