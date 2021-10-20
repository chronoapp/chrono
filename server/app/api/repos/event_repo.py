import heapq
from typing import List, Optional, Iterable
from datetime import datetime
from googleapiclient.errors import HttpError

from sqlalchemy import asc, and_, select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, desc

from app.core.logger import logger
from app.db.sql.event_search import EVENT_SEARCH_QUERY
from app.db.models import Event, User, Calendar
from app.api.repos.event_utils import (
    InputError,
    EventBaseVM,
    EventInDBVM,
    createOrUpdateEvent,
    getRecurringEventId,
    verifyAndGetRecurringEventParent,
    getAllExpandedRecurringEventsList,
)
from app.calendar.google import (
    insertGoogleEvent,
    deleteGoogleEvent,
)
from app.api.endpoints.labels import LabelInDbVM, Label, combineLabels

"""
Combination of a Service / Repository over events.
Provides an abstraction over SQLAlchemy.
"""


class EventNotFound(Exception):
    pass


class CalendarNotFound(Exception):
    pass


class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def getEventsInRange(
        self, user: User, startDate: datetime, endDate: datetime, limit: int
    ) -> Iterable[EventInDBVM]:
        selectStmt = (
            user.getSingleEventsStmt(showRecurring=False)
            .filter(and_(Event.end >= startDate, Event.start <= endDate))
            .order_by(asc(Event.start))
            .limit(limit)
        )
        result = await self.session.execute(selectStmt)
        singleEvents = result.scalars().all()

        expandedRecurringEvents = await getAllExpandedRecurringEventsList(
            user, startDate, endDate, self.session
        )
        allEvents = heapq.merge(expandedRecurringEvents, singleEvents, key=lambda event: event.start)

        return allEvents

    async def getEvent(self, user: User, eventId: str) -> Optional[Event]:
        curEvent: Optional[Event] = (
            await self.session.execute(
                select(Event)
                .where(and_(User.id == user.id, Event.id == eventId))
                .options(selectinload(Event.labels))
                .options(selectinload(Event.calendar))
            )
        ).scalar()

        return curEvent

    async def createEvent(self, user: User, event: EventBaseVM) -> Event:
        calendarResult = await self.session.execute(
            select(Calendar).where(and_(Calendar.user_id == user.id, Calendar.id == event.calendar_id))
        )
        calendarDb: Optional[Calendar] = calendarResult.scalar()
        if not calendarDb:
            raise CalendarNotFound('Calendar not found.')

        # Keeps track of the "Original" time this recurrence should have started.
        if event.recurrences or event.recurring_event_id:
            event.original_start = event.start
            event.original_start_day = event.start_day
            event.original_timezone = event.timezone

        eventDb = createOrUpdateEvent(None, event)
        eventDb.labels = await getCombinedLabels(user, event.labels, self.session)
        eventDb.calendar = calendarDb
        user.events.append(eventDb)

        # Sync with google calendar. TODO: Add flag for sync status
        if calendarDb.google_id:
            resp = insertGoogleEvent(user, eventDb)
            eventDb.g_id = resp.get('id')

        return eventDb

    async def delete(self, user: User, eventId: str) -> Event:
        stmt = (
            select(Event)
            .where(and_(Event.user_id == user.id, Event.id == eventId, Event.status != 'deleted'))
            .options(selectinload(Event.labels))
        )
        event = (await self.session.execute(stmt)).scalar()

        if event:
            event.status = 'deleted'

            # If the parent is deleted, we can delete all child event.
            # TODO: Foreign keys?
            stmt = delete(Event).where(and_(Event.user_id == user.id, Event.recurring_event_id == event.id))
            await self.session.execute(stmt)

            # Delete from Google
            if event.g_id:
                try:
                    _ = deleteGoogleEvent(user, event)
                except HttpError as e:
                    logger.error(e)

        else:
            # Virtual recurring event instance.
            try:
                event = await createOverrideDeletedEvent(user, eventId, self.session)
                user.events.append(event)

            except InputError as e:
                raise EventNotFound('Event not found.')

    async def search(self, userId: int, searchQuery: str, limit: int = 250) -> List[Event]:
        rows = await self.session.execute(
            text(EVENT_SEARCH_QUERY), {'userId': userId, 'query': searchQuery, 'limit': limit}
        )
        rowIds = [r[0] for r in rows]

        stmt = (
            select(Event)
            .filter(Event.id.in_(rowIds))
            .order_by(desc(Event.end))
            .options(selectinload(Event.labels))
        )
        result = await self.session.execute(stmt)

        return result.scalars().all()

    async def searchByTitle(
        self, user: User, title: str, startDate: datetime, endDate: datetime, limit: int = 250
    ) -> List[Event]:
        selectStmt = (
            user.getSingleEventsStmt(showRecurring=False)
            .filter(and_(Event.end >= startDate, Event.start <= endDate, Event.title.ilike(title)))
            .limit(limit)
        )
        result = await self.session.execute(selectStmt)

        return result.scalars().all()


async def getCombinedLabels(user: User, labelVMs: List[LabelInDbVM], session: AsyncSession) -> List[Label]:
    """"List of labels, with parents removed if the list includes the child"""
    labels: List[Label] = []
    for labelVM in labelVMs:
        # TODO: Bulk Query
        stmt = select(Label).where(and_(User.id == user.id, Label.id == labelVM.id))
        label = (await session.execute(stmt)).scalar()

        if label:
            labels.append(label)

    return combineLabels(labels)


async def createOverrideDeletedEvent(user: User, eventId: str, session: AsyncSession):
    # Override as a deleted event.
    parentEvent, dt = await verifyAndGetRecurringEventParent(user, eventId, session)

    googleId = None
    if parentEvent.recurring_event_gId:
        googleId = getRecurringEventId(parentEvent.recurring_event_gId, dt, parentEvent.all_day)

    event = Event(
        googleId,
        None,
        None,
        None,
        None,
        None,
        None,
        parentEvent.calendar.id,
        None,
        None,
        dt,
        dt.strftime('%Y-%m-%d') if parentEvent.all_day else None,
        parentEvent.time_zone,
        overrideId=eventId,
        recurringEventId=parentEvent.id,
        status='deleted',
    )

    return event
