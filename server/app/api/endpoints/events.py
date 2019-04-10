from sqlalchemy import desc
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.endpoints.labels import LabelVM
from app.core.logger import logger
from app.db.models import Event

router = APIRouter()


class EventVM(BaseModel):
    """Viewmodel for events.
    """
    id: int
    title: str
    description: Optional[str] = None
    start_time: str
    end_time: str
    labels: List[LabelVM]


@router.get('/events/', response_model=List[EventVM])
async def getEvents(
        user=Depends(get_current_user),
        session=Depends(get_db)):

    return user.events.order_by(desc(Event.end_time))\
        .limit(100).all()


@router.get('/event/{event_id}')
async def getEvent(
        event_id: int,
        user=Depends(get_current_user),
        session=Depends(get_db)):

    return user.events.filter_by(id=event_id).first()
