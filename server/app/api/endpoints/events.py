from datetime import datetime, timedelta

from sqlalchemy import desc, and_
from sqlalchemy.orm import Session
from typing import List, Optional
from googleapiclient.errors import HttpError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.api.endpoints.labels import LabelVM, LabelInDbVM, Label, combineLabels
from app.core.logger import logger
from app.db.models import Event, User
from app.calendar.google import insertGoogleEvent, deleteGoogleEvent, updateGoogleEvent, moveGoogleEvent

router = APIRouter()


class EventBaseVM(BaseModel):
    """Viewmodel for events.
    """
    title: Optional[str]
    description: Optional[str] = None
    start: datetime
    end: datetime
    start_day: Optional[str]
    end_day: Optional[str]

    labels: List[LabelInDbVM] = []
    all_day: Optional[bool]
    background_color: Optional[str]
    calendar_id: str

    class Config:
        orm_mode = True


class EventInDBVM(EventBaseVM):
    id: int


def getCombinedLabels(user: User, labelVMs: List[LabelInDbVM]) -> List[Label]:
    labels: List[Label] = []
    for labelVM in labelVMs:
        label = user.labels.filter_by(id=labelVM.id).one_or_none()
        if label:
            labels.append(label)

    return combineLabels(labels)


@router.get('/events/', response_model=List[EventInDBVM])
async def getEvents(
    title: str = "",
    query: str = "",
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
) -> List[Event]:

    startFilter = datetime.fromisoformat(start_date) if start_date\
        else datetime.now() - timedelta(days=365)
    endFilter = datetime.fromisoformat(end_date) if end_date else datetime.now()

    logger.info(f'getEvents:{user.id}')
    logger.info(f'query:{query}')

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
async def createEvent(
    event: EventBaseVM, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Event:
    try:
        calendarDb = user.calendars.filter_by(id=event.calendar_id).one_or_none()
        eventDb = Event(None, event.title, event.description, event.start, event.end,
                        event.start_day, event.end_day, event.calendar_id)

        eventDb.labels = getCombinedLabels(user, event.labels)
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
async def getEvent(
    event_id: int, user: User = Depends(get_current_user),
    session: Session = Depends(get_db)) -> Event:

    event = user.events.filter_by(id=event_id).one_or_none()
    if not event:
        raise HTTPException(HTTP_404_NOT_FOUND)

    return event


@router.put('/events/{event_id}', response_model=EventInDBVM)
async def updateEvent(
    event: EventBaseVM,
    event_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db)) -> Event:

    prevCalendarId: Optional[str] = None
    eventDb = user.events.filter_by(id=event_id).first()
    if eventDb and not eventDb.isWritable():
        raise HTTPException(HTTP_403_FORBIDDEN, detail="Can not update event.")

    if not eventDb:
        eventDb = Event(None, event.title, event.description, event.start, event.end,
                        event.start_day, event.end_day, event.calendar_id)
    else:
        if event.title:
            eventDb.title = event.title
            eventDb.description = event.description
            eventDb.start = event.start
            eventDb.end = event.end
            eventDb.start_day = event.start_day
            eventDb.end_day = event.end_day
            prevCalendarId = eventDb.calendar_id
            eventDb.calendar_id = event.calendar_id
            # TODO: Update other fields

    eventDb.labels.clear()
    eventDb.labels = getCombinedLabels(user, event.labels)

    if user.syncWithGoogle():
        if prevCalendarId and prevCalendarId != eventDb.calendar_id:
            moveGoogleEvent(user, eventDb, prevCalendarId)

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
        if event.g_id:
            try:
                deleteGoogleEvent(user, event)
            except HttpError as e:
                logger.error(e)

        session.delete(event)
        session.commit()

    return {}
