import uuid

import googleapiclient
from worker import dramatiq

from app.db.repos.event_repo.event_repo import EventRepository
from app.db.repos.user_repo import UserRepository
from app.db.repos.calendar_repo import CalendarRepository
from app.db.repos.webhook_repo import WebhookRepository
from app.db.session import scoped_session

from . import gcal
from .calendar import (
    syncCreatedOrUpdatedGoogleEvent,
    syncCalendarEvents,
    syncAllCalendars,
)
from app.core.logger import logger
from app.core.notifications import sendClientNotification, NotificationType


"""Tasks to process google event syncing in background tasks.
"""


@dramatiq.actor(max_retries=1)
def syncEventToGoogleTask(
    userId: uuid.UUID,
    userCalendarId: uuid.UUID,
    eventId: str,
    sendUpdates: gcal.SendUpdateType,
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

        if event.google_id:
            eventResp = gcal.updateGoogleEvent(
                userCalendar,
                event,
                sendUpdates,
            )
        else:
            eventResp = gcal.createGoogleEvent(
                userCalendar,
                event,
                sendUpdates,
            )

        event = syncCreatedOrUpdatedGoogleEvent(userCalendar, eventRepo, event, eventResp, session)

        logger.info(f'Synced event {event.title} {event.id=} to Google {event.google_id}')


@dramatiq.actor(max_retries=1)
def syncDeleteEventToGoogleTask(
    userId: uuid.UUID, userCalendarId: uuid.UUID, eventId: str, sendUpdates: gcal.SendUpdateType
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
            resp = gcal.deleteGoogleEvent(
                userCalendar.account, userCalendar.google_id, event.google_id, sendUpdates
            )
            logger.info(f'Deleted event from Google: {event.title} {event.id=} {event.google_id=}')


@dramatiq.actor(max_retries=1)
def syncMoveGoogleEventCalendarTask(
    userId: uuid.UUID,
    googleEventId: str,
    fromCalendarId: uuid.UUID,
    toCalendarId: uuid.UUID,
    sendUpdates: gcal.SendUpdateType,
) -> None:
    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)

        user = userRepo.getUser(userId)
        fromCalendar = calRepo.getCalendar(user, fromCalendarId)
        toCalendar = calRepo.getCalendar(user, toCalendarId)

        if not fromCalendar or not toCalendar:
            logger.warning(f'Calendar not found')

        _resp = gcal.moveGoogleEvent(
            fromCalendar.account,
            googleEventId,
            fromCalendar.google_id,
            toCalendar.google_id,
            sendUpdates,
        )
        logger.info(f'Moved event {googleEventId}')


@dramatiq.actor(max_retries=1)
def syncAllCalendarsTask(accountId: uuid.UUID, fullSync: bool) -> None:
    """
    1) Sync all calendars from google calendar account.
    2) Creates webhooks for the account's calendars.
    3) Syncs events from the account's calendars.

    TODO: Use the syncToken to do an incremental sync.
    """

    # 1) Sync calendar list.
    with scoped_session() as session:
        userRepo = UserRepository(session)
        userAccount = userRepo.getUserAccount(accountId)

        syncAllCalendars(userAccount, session)

    # 2) Create webhooks and all events for all connected calendars.
    with scoped_session() as session:
        userRepo = UserRepository(session)
        userAccount = userRepo.getUserAccount(accountId)

        webhookRepo = WebhookRepository(session)
        webhookRepo.createCalendarListWebhook(userAccount)

        for calendar in userAccount.calendars:
            webhookRepo.createCalendarEventsWebhook(userAccount, calendar)
            syncCalendarTask.send(accountId, calendar.id, fullSync, sendNotification=False)

        sendClientNotification(str(userAccount.user_id), NotificationType.REFRESH_CALENDAR_LIST)


@dramatiq.actor(max_retries=1)
def syncCalendarTask(
    accountId: uuid.UUID, calendarId: uuid.UUID, fullSync: bool, sendNotification=True
) -> None:
    """Syncs events from a single calendar."""
    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)

        userAccount = userRepo.getUserAccount(accountId)
        calendar = calRepo.getCalendar(userAccount.user, calendarId)

        syncCalendarEvents(calendar, session, fullSync)

        # Send notification to client
        if sendNotification:
            sendClientNotification(str(userAccount.user_id), NotificationType.REFRESH_CALENDAR)


@dramatiq.actor(max_retries=1)
def updateCalendarTask(userId: uuid.UUID, calendarId: uuid.UUID) -> None:
    """Update google calendar details like summary, selected, color"""

    with scoped_session() as session:
        userRepo = UserRepository(session)
        calRepo = CalendarRepository(session)

        user = userRepo.getUser(userId)
        userCalendar = calRepo.getCalendar(user, calendarId)
        gcal.updateUserCalendar(userCalendar.account, userCalendar)

        if userCalendar.hasWriteAccess():
            gcal.updateCalendar(userCalendar.account, userCalendar.calendar)
