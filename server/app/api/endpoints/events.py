from datetime import datetime, timedelta

from sqlalchemy import desc, and_, or_
from sqlalchemy.orm import Session
from typing import List, Optional, Literal, Tuple
from googleapiclient.errors import HttpError
from dateutil.rrule import rrule, YEARLY, MONTHLY, WEEKLY, DAILY, HOURLY
from backports.zoneinfo import ZoneInfo

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


MAX_RECURRING_EVENT_COUNT = 1000

UpdateOption = Literal['SINGLE', 'ALL', 'FOLLOWING']


class Error(Exception):
    """Base class for exceptions in this module."""
    pass


class InputError(Error):
    """Exception raised for errors in the input."""
    pass


def convertToLocalTime(dateTime: datetime, timeZone: str):
    localAware = dateTime.astimezone(ZoneInfo(timeZone))  # convert
    return localAware


def getRRule(startDate: datetime, freq: int, interval: int, occurrences: Optional[int],
             until: Optional[datetime]) -> rrule:
    if until and occurrences:
        raise InputError('Until and occurrences cannot both be set.')
    if not until and not occurrences:
        raise InputError('Either until or occurrences must be set.')

    count = None
    if not until:
        count = min(MAX_RECURRING_EVENT_COUNT,
                    occurrences) if occurrences else MAX_RECURRING_EVENT_COUNT

    if count:
        rule = rrule(dtstart=startDate, freq=freq, interval=interval, count=count)
    else:
        rule = rrule(dtstart=startDate, freq=freq, interval=interval, until=until)

    return rule


def createRecurringEvents(user: User, rule: rrule, event: EventBaseVM, timezone: str) -> None:
    """Creates all recurring events with this rule.
    # TODO: Handle Full day events
    # TODO: Handle multiple rules
    """
    duration = event.end - event.start

    # First event.
    recurringEvent = Event(None, event.title, event.description, event.start, event.end, None, None,
                           event.calendar_id, timezone)
    recurringEvent.recurrences = [str(rule)]
    user.events.append(recurringEvent)

    for date in list(rule)[1:]:
        start = date.replace(tzinfo=ZoneInfo(timezone))
        end = start + duration
        event = Event(None, event.title, event.description, start, end, None, None,
                      event.calendar_id, timezone)
        event.recurring_event = recurringEvent
        user.events.append(event)


def updateRecurringEvent(user: User, event: Event, updateEvent: EventBaseVM,
                         updateOption: UpdateOption, session: Session):
    """Bulk updates for recurring events.
    """
    if updateOption == 'SINGLE':
        createOrUpdateEvent(event, updateEvent)

    elif updateOption == 'ALL':
        if event.is_parent_recurring_event:
            baseEvent = event
        else:
            baseEvent = session.query(Event).filter(
                Event.id == event.recurring_event_id).one_or_none()

        # normalize datetime to the base event.
        startDiff = updateEvent.start - event.original_start
        duration = updateEvent.end - updateEvent.start
        newStart = baseEvent.original_start + startDiff

        if baseEvent:
            updateRecurringEvent(
                user, baseEvent,
                updateEvent.copy(update={
                    'start': newStart,
                    'end': newStart + duration
                }), 'FOLLOWING', session)

    elif updateOption == 'FOLLOWING':
        if event.is_parent_recurring_event:
            print('is_parent_recurring_event')
            followingEvents = session.query(Event).filter(
                and_(or_(Event.recurring_event_id == event.id, Event.id == event.id),
                     Event.start >= event.start))
        else:
            followingEvents = session.query(Event).filter(
                and_(Event.recurring_event_id == event.recurring_event_id,
                     Event.start >= event.start))

        # Shift from the original time.
        startDiff = updateEvent.start - event.original_start
        duration = updateEvent.end - updateEvent.start
        for e in followingEvents:
            newStart = e.original_start + startDiff
            createOrUpdateEvent(
                e, updateEvent.copy(update={
                    'start': newStart,
                    'end': newStart + duration
                }))
    else:
        raise InputError(f'updateOption must be {UpdateOption}')


def deleteRecurringEvent(user: User, event: Event, updateOption: UpdateOption, session: Session):
    if updateOption == 'SINGLE':
        if event.is_parent_recurring_event:
            # DONOTSHIP: Set status = 'deleted'
            pass
        else:
            session.delete(event)

    elif updateOption == 'ALL':
        user.events.filter(Event.recurring_event_id == event.recurring_event_id).delete()
        user.events.filter(Event.id == event.recurring_event_id).delete()

    elif updateOption == 'FOLLOWING':
        session.query(Event).filter(
            and_(Event.recurring_event_id == event.recurring_event_id,
                 Event.start >= event.start)).delete()

    else:
        raise InputError(f'updateOption must be {UpdateOption}')


def getCombinedLabels(user: User, labelVMs: List[LabelInDbVM]) -> List[Label]:
    """"List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []
    for labelVM in labelVMs:
        label = user.labels.filter_by(id=labelVM.id).one_or_none()
        if label:
            labels.append(label)

    return combineLabels(labels)


def createOrUpdateEvent(eventDb: Optional[Event],
                        event: EventBaseVM) -> Tuple[Event, Optional[str]]:
    if eventDb and not eventDb.isWritable():
        raise HTTPException(HTTP_403_FORBIDDEN, detail="Can not update event.")

    prevCalendarId = None
    if not eventDb:
        eventDb = Event(None, event.title, event.description, event.start, event.end,
                        event.start_day, event.end_day, event.calendar_id, None)
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

    return eventDb, prevCalendarId


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
                        event.start_day, event.end_day, event.calendar_id, None)

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

    existingEvent = user.events.filter_by(id=event_id).one_or_none()
    eventDb, prevCalendarId = createOrUpdateEvent(existingEvent, event)

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
    """Delete an event.
    TODO: Handle recurring events.
    - Option to delete this event only.
    """
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
