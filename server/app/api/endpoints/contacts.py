from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

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


@router.get('/contacts/{contact_id}', response_model=ContactInDBVM)
async def getContact(
    contact_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    contactRepo = ContactRepository(session)

    contact = contactRepo.getContact(user, contact_id)
    if not contact:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    return contact


@router.get('/contacts/', response_model=List[ContactInDBVM])
async def getContacts(
    user: User = Depends(get_current_user),
    query: str = "",
    limit: int = 25,
    session: Session = Depends(get_db),
):
    """TODO: Pagination."""
    contactRepo = ContactRepository(session)

    if query:
        return contactRepo.searchContacts(user, query, limit)
    else:
        return contactRepo.getContacts(user, limit)
