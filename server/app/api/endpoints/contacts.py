from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, validator

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import User, Contact

router = APIRouter()


class ContactBaseVM(BaseModel):
    first_name: Optional[str] = Field(alias='firstName')
    last_name: Optional[str] = Field(alias='lastName')
    email_address: Optional[str] = Field(alias='emailAddress')

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class ContactVM(ContactBaseVM):
    id: str


@router.get('/contacts/', response_model=List[ContactVM])
async def getContacts(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)
):
    """TODO: Pagination."""
    result = await session.execute(select(Contact).where(Contact.user_id == user.id))
    contacts = result.scalars().all()

    return contacts
