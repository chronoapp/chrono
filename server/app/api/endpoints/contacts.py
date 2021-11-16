from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, validator

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import User, Contact
from app.db.sql.contact_search import CONTACT_SEARCH_QUERY

router = APIRouter()


class ContactBaseVM(BaseModel):
    first_name: Optional[str] = Field(alias='firstName')
    last_name: Optional[str] = Field(alias='lastName')
    email_address: Optional[str] = Field(alias='emailAddress')
    photo_url: Optional[str] = Field(alias='photoUrl')

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class ContactVM(ContactBaseVM):
    id: str


@router.get('/contacts/', response_model=List[ContactVM])
async def getContacts(
    user: User = Depends(get_current_user),
    query: str = "",
    limit: int = 50,
    session: AsyncSession = Depends(get_db),
):
    """TODO: Pagination."""

    if query:
        rows = await session.execute(
            text(CONTACT_SEARCH_QUERY), {'userId': user.id, 'query': query, 'limit': limit}
        )
        rowIds = [r[0] for r in rows]

        stmt = select(Contact).filter(Contact.id.in_(rowIds))
        result = await session.execute(stmt)

        return result.scalars().all()

    else:
        result = await session.execute(
            select(Contact).where(Contact.user_id == user.id).limit(limit)
        )
        return result.scalars().all()
