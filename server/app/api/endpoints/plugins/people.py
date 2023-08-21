from sqlalchemy.orm import Session

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.repos.contact_repo import ContactRepository, ContactInEventVM
from app.api.utils.security import get_current_user
from app.api.utils.db import get_db

router = APIRouter()


@router.get('/plugins/people/')
async def getUserTrends(
    start: datetime = datetime.now() - timedelta(days=365),
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
) -> list[ContactInEventVM]:
    contactRepo = ContactRepository(session)
    try:
        contactInEvents = contactRepo.getContactsInEvents(user, start)

        return contactInEvents

    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
