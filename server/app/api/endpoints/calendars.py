from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import User

router = APIRouter()


class CalendarVM(BaseModel):
    id: str
    summary: str
    description: Optional[str]
    background_color: str
    selected: bool
    primary: Optional[bool]

    class Config:
        orm_mode = True


@router.get('/calendars/', response_model=List[CalendarVM])
async def getCalendars(user: User = Depends(get_current_user), session: Session = Depends(get_db)):

    return user.calendars.all()
