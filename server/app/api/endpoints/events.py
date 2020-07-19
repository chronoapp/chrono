from datetime import datetime, timedelta

from sqlalchemy import desc, and_
from sqlalchemy.orm import Session
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from starlette.status import HTTP_400_BAD_REQUEST

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.endpoints.labels import LabelVM
from app.core.logger import logger
from app.db.models import Event, User
from app.calendar.sync import insertGoogleEvent, deleteGoogleEvent, updateGoogleEvent

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

    try:
        calendarDb = user.calendars.filter_by(id=event.calendar_id).one_or_none()
        eventDb = Event(None, event.title, event.description, event.start, event.end,
                        event.calendar_id)
        eventDb.calendar = calendarDb
        user.events.append(eventDb)

        if user.syncWithGoogle():
            resp = insertGoogleEvent(user, eventDb)
            logger.info(resp.get('start'))
            logger.info(resp.get('id'))
            eventDb.g_id = resp.get('id')

        session.add(eventDb)
        session.commit()

        return eventDb

    except Exception as e:
        logger.error(e)
        raise HTTPException(HTTP_400_BAD_REQUEST)


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
            eventDb.description = event.description
            eventDb.start = event.start
            eventDb.end = event.end
            # TODO: Update other fields.

    eventDb.labels.clear()
    for label in event.labels:
        label = user.labels.filter_by(key=label.key).first()
        eventDb.labels.append(label)

    if user.syncWithGoogle():
        updateGoogleEvent(user, eventDb)

    session.commit()
    session.refresh(eventDb)

    return eventDb


@router.delete('/events/{eventId}')
async def deleteEvent(eventId: int,
                      user: User = Depends(get_current_user),
                      session: Session = Depends(get_db)):
    logger.info(f'Delete Event {eventId}')
    event = user.events.filter_by(id=eventId).one_or_none()
    if event:
        if user.syncWithGoogle():
            deleteGoogleEvent(user, event)

        session.delete(event)
        session.commit()

    return {}
