from datetime import datetime, timedelta

from sqlalchemy import desc, and_
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
    title: Optional[str]
    description: Optional[str] = None
    start: datetime
    end: datetime
    labels: List[LabelVM] = []
    all_day: Optional[bool]
    background_color: Optional[str]
    calendar_id: str

    class Config:
        orm_mode = True


class EventInDBVM(EventBaseVM):
    id: int


@router.get('/events/', response_model=List[EventInDBVM])
async def getEvents(title: str = "",
                    query: str = "",
                    limit: int = 100,
                    start_date: Optional[str] = None,
                    end_date: Optional[str] = None,
                    user: User = Depends(get_current_user),
                    session: Session = Depends(get_db)):

    startFilter = datetime.fromisoformat(start_date) if start_date\
        else datetime.now() - timedelta(days=365)
    endFilter = datetime.fromisoformat(end_date) if end_date else datetime.now()

    logger.info(f'getEvents:{user.username}')
    logger.info(f'query:{query}')
    logger.info(f'limit:{limit}')

    if title:
        return user.events.filter(and_(Event.start <= datetime.now(),
                                       Event.title.ilike(title))).all()
    elif query:
        tsQuery = ' & '.join(query.split())
        return Event.search(session, user.id, tsQuery)
    else:
        return user.events.filter(and_(Event.start >= startFilter, Event.start <= endFilter))\
            .order_by(desc(Event.start))\
            .limit(limit).all()


@router.post('/events/', response_model=EventInDBVM)
async def createEvent(event: EventBaseVM,
                      user: User = Depends(get_current_user),
                      session: Session = Depends(get_db)):
    eventDb = Event(None, event.title, event.description, event.start, event.end, event.calendar_id)
    user.events.append(eventDb)
    session.commit()

    return eventDb


@router.get('/events/{event_id}', response_model=EventInDBVM)
async def getEvent(event_id: int,
                   user: User = Depends(get_current_user),
                   session: Session = Depends(get_db)):

    return user.events.filter_by(id=event_id).first()


@router.put('/events/{event_id}', response_model=EventInDBVM)
async def updateEvent(
    event: EventBaseVM,
    event_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db)) -> Event:

    eventDb = user.events.filter_by(id=event_id).first()
    if not eventDb:
        eventDb = Event(None, event.title, event.description, event.start, event.end,
                        event.calendar_id)
    else:
        if event.title:
            eventDb.title = event.title
            # TODO: Update other fields.

    eventDb.labels.clear()
    for label in event.labels:
        label = user.labels.filter_by(key=label.key).first()
        eventDb.labels.append(label)

    session.commit()
    session.refresh(eventDb)

    return eventDb
