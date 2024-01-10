import uuid

import googleapiclient
from worker import dramatiq

from app.db.repos.event_repo.event_repo import EventRepository
from app.db.repos.user_repo import UserRepository
from app.db.repos.calendar_repo import CalendarRepository
from app.db.repos.webhook_repo import WebhookRepository
from app.db.session import scoped_session

from .gcal import (
    SendUpdateType,
    moveGoogleEvent,
    updateGoogleEvent,
    getEventBody,
    createGoogleEvent,
    deleteGoogleEvent,
    updateCalendar,
)
from .calendar import (
    syncCreatedOrUpdatedGoogleEvent,
    syncCalendarEvents,
    syncCalendarsAndACL,
)
from app.core.logger import logger


"""Tasks to process google event syncing in background tasks.
"""


@dramatiq.actor(max_retries=1)
def syncEventToGoogleTask(
    userId: uuid.UUID,
    userCalendarId: uuid.UUID,
    eventId: str,
    sendUpdates: SendUpdateType,
) -> None:
    """Sync Chrono's event to Google Calendar."""

    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)
        eventRepo = EventRepository(session)

        user = userRepo.getUser(userId)
        userCalendar = calRepo.getCalendar(user, userCalendarId)
        if not userCalendar:
            logger.error(f'User calendar {userCalendarId} not found')
            return

        event = eventRepo.getEvent(user, userCalendar, eventId)
        if not event:
            logger.warning(f'Event {eventId} not found')
            return

        eventBody = getEventBody(event, userCalendar.timezone)

        if event.google_id:
            eventResp = updateGoogleEvent(
                user, userCalendar.google_id, event.google_id, eventBody, sendUpdates
            )
        else:
            eventResp = createGoogleEvent(user, userCalendar.google_id, eventBody, sendUpdates)

        event = syncCreatedOrUpdatedGoogleEvent(userCalendar, eventRepo, event, eventResp, session)

        logger.info(f'Synced event {event.title} {event.id=} to Google {event.google_id}')


@dramatiq.actor(max_retries=1)
def syncDeleteEventToGoogleTask(
    userId: uuid.UUID, userCalendarId: uuid.UUID, eventId: str, sendUpdates: SendUpdateType
) -> None:
    """Sync Chrono's event to Google Calendar."""

    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)
        eventRepo = EventRepository(session)

        user = userRepo.getUser(userId)
        userCalendar = calRepo.getCalendar(user, userCalendarId)
        event = eventRepo.getEventVM(user, userCalendar, eventId)
        if not event:
            logger.warning(f'Event {eventId} not found')
            return

        if event.google_id:
            try:
                _resp = deleteGoogleEvent(
                    user, userCalendar.google_id, event.google_id, sendUpdates
                )
                logger.info(
                    f'Deleted event from Google: {event.title} {event.id=} {event.google_id=}'
                )
            except googleapiclient.errors.HttpError as e:
                logger.warning(e)


@dramatiq.actor(max_retries=1)
def syncMoveGoogleEventCalendarTask(
    userId: uuid.UUID,
    googleEventId: str,
    fromCalendarId: uuid.UUID,
    toCalendarId: uuid.UUID,
    sendUpdates: SendUpdateType,
) -> None:
    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)

        user = userRepo.getUser(userId)
        fromCalendar = calRepo.getCalendar(user, fromCalendarId)
        toCalendar = calRepo.getCalendar(user, toCalendarId)

        if not fromCalendar or not toCalendar:
            logger.warning(f'Calendar not found')

        _resp = moveGoogleEvent(
            user, googleEventId, fromCalendar.google_id, toCalendar.google_id, sendUpdates
        )
        logger.info(f'Moved event {googleEventId}')


@dramatiq.actor(max_retries=1)
def syncAllCalendarsTask(userId: uuid.UUID, fullSync: bool) -> None:
    """Syncs events from google calendar."""

    with scoped_session() as session:
        userRepo = UserRepository(session)
        webhookRepo = WebhookRepository(session)
        user = userRepo.getUser(userId)

        syncCalendarsAndACL(user)
        session.commit()

        for calendar in user.calendars:
            if calendar.google_id != None:
                webhookRepo.createCalendarWebhook(calendar)
                syncCalendarTask.send(user.id, calendar.id, False)


@dramatiq.actor(max_retries=1)
def syncCalendarTask(userId: uuid.UUID, calendarId: uuid.UUID, fullSync: bool) -> None:
    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)

        user = userRepo.getUser(userId)
        calendar = calRepo.getCalendar(user, calendarId)

        syncCalendarEvents(calendar, session, fullSync)


@dramatiq.actor(max_retries=1)
def updateCalendarTask(userId: uuid.UUID, calendarId: uuid.UUID) -> None:
    """Update google calendar details like summary, selected, color"""

    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)

        user = userRepo.getUser(userId)
        calendar = calRepo.getCalendar(user, calendarId)

        logger.debug(f'Update Calendar {calendar.google_id}')
        updateCalendar(user, calendar)
