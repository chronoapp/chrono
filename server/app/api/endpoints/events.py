from sqlalchemy import desc
from sqlalchemy.orm import Session
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.endpoints.labels import LabelVM
from app.core.logger import logger
from app.db.models import Event, User

router = APIRouter()


class EventBaseVM(BaseModel):
    """Viewmodel for events.
    """
    title: str
    description: Optional[str] = None
    start_time: Optional[str]
    end_time: Optional[str]
    labels: List[LabelVM] = []


class EventInDBVM(EventBaseVM):
    id: int


@router.get('/events/', response_model=List[EventInDBVM])
async def getEvents(
        query: str = "",
        limit: int = 100,
        user: User = Depends(get_current_user),
        session: Session = Depends(get_db)):

    logger.info(f'getEvents:{user.username}')
    logger.info(f'query:{query}')
    logger.info(f'limit:{limit}')

    if query:
        return Event.search(session, user.id, query)
    else:
        return user.events.order_by(desc(Event.end_time))\
            .limit(limit).all()


@router.get('/events/{event_id}', response_model=EventInDBVM)
async def getEvent(
        event_id: int,
        user: User = Depends(get_current_user),
        session: Session = Depends(get_db)):

    logger.info(event_id)
    return user.events.filter_by(id=event_id).first()


@router.put('/events/{event_id}', response_model=EventInDBVM)
async def updateEvent(
        event: EventBaseVM,
        event_id: int,
        user: User = Depends(get_current_user),
        session: Session = Depends(get_db)):

    eventDb = user.events.filter_by(id=event_id).first()
    if not eventDb:
        eventDb = Event(
            None, event.title, event.description,
            event.start_time, event.end_time)
    else:
        logger.info(event)
        if event.title:
            eventDb.title = event.title

        eventDb.labels.clear()
        for label in event.labels:
            label = user.labels.filter_by(key=label.key).first()
            eventDb.labels.append(label)

        # TODO: Update other fields.

    session.commit()
    session.refresh(eventDb)

    return eventDb
