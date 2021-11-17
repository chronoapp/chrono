from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.repos.contact_repo import ContactRepository
from app.db.models import User

router = APIRouter()


class ContactBaseVM(BaseModel):
    first_name: Optional[str] = Field(alias='firstName')
    last_name: Optional[str] = Field(alias='lastName')
    email: Optional[str] = Field(alias='email')
    photo_url: Optional[str] = Field(alias='photoUrl')
    display_name: Optional[str] = Field(alias='displayName')

    class Config:
        orm_mode = True
        allow_population_by_field_name = True


class ContactInDBVM(ContactBaseVM):
    id: str


@router.get('/contacts/', response_model=List[ContactInDBVM])
async def getContacts(
    user: User = Depends(get_current_user),
    query: str = "",
    limit: int = 50,
    session: AsyncSession = Depends(get_db),
):
    """TODO: Pagination."""
    contactRepo = ContactRepository(session)

    if query:
        return await contactRepo.searchContacts(user, query, limit)
    else:
        return await contactRepo.getContacts(user, limit)
