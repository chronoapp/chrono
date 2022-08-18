import asyncio
import googleapiclient
from worker import dramatiq

from app.api.repos.event_repo import EventRepository
from app.api.repos.user_repo import UserRepository
from app.api.repos.calendar_repo import CalendarRepo
from app.db.session import AsyncSession

from .gcal import (
    SendUpdateType,
    moveGoogleEvent,
    updateGoogleEvent,
    getEventBody,
    createGoogleEvent,
    deleteGoogleEvent,
)
from .calendar import syncCreatedOrUpdatedGoogleEvent
from app.core.logger import logger


"""Tasks to process google event syncing in background tasks.
"""


@dramatiq.actor(max_retries=1)
def syncEventToGoogleTask(
    userId: int, userCalendarId: str, eventId: str, sendUpdates: SendUpdateType = 'none'
):
    """Sync Chrono's event to Google Calendar."""

    async def syncEventToGoogle():
        async with AsyncSession() as session:
            userRepo = UserRepository(session)
            calRepo = CalendarRepo(session)
            eventRepo = EventRepository(session)

            user = await userRepo.getUser(userId)
            userCalendar = await calRepo.getCalendar(user, userCalendarId)
            if not userCalendar:
                logger.error(f'User calendar {userCalendarId} not found')
                return

            event = await eventRepo.getEvent(user, userCalendar, eventId)
            if not event:
                logger.warning(f'Event {eventId} not found')
                return

            eventBody = getEventBody(event, userCalendar.timezone)

            if event.g_id:
                eventResp = updateGoogleEvent(
                    user, userCalendar.google_id, event.g_id, eventBody, sendUpdates
                )
            else:
                eventResp = createGoogleEvent(user, userCalendar.google_id, eventBody, sendUpdates)

            event = await syncCreatedOrUpdatedGoogleEvent(
                userCalendar, eventRepo, event, eventResp, session
            )
            await session.commit()

            logger.info(f'Synced event {event.title} {event.id=} to Google {event.g_id}')

    asyncio.run(syncEventToGoogle())


@dramatiq.actor(max_retries=1)
def syncDeleteEventToGoogleTask(userId: int, userCalendarId: str, eventId: str):
    """Sync Chrono's event to Google Calendar."""

    async def syncDeleteEventToGoogle():
        async with AsyncSession() as session:
            userRepo = UserRepository(session)
            calRepo = CalendarRepo(session)
            eventRepo = EventRepository(session)

            user = await userRepo.getUser(userId)
            userCalendar = await calRepo.getCalendar(user, userCalendarId)
            event = await eventRepo.getEventVM(user, userCalendar, eventId)

            if event.g_id:
                try:
                    _resp = deleteGoogleEvent(user, userCalendar.google_id, event.g_id)
                    logger.info(f'Deleted event from Google: {event.id} {event.g_id}')
                except googleapiclient.errors.HttpError as e:
                    logger.warning(e)

    asyncio.run(syncDeleteEventToGoogle())


@dramatiq.actor(max_retries=1)
def syncMoveGoogleEventCalendarTask(
    userId: int, googleEventId: str, fromCalendarId: str, toCalendarId: str
):
    async def syncMoveGoogleEventCalendar():
        async with AsyncSession() as session:
            userRepo = UserRepository(session)
            calRepo = CalendarRepo(session)

            user = await userRepo.getUser(userId)
            fromCalendar = await calRepo.getCalendar(user, fromCalendarId)
            toCalendar = await calRepo.getCalendar(user, toCalendarId)

            if not fromCalendar or not toCalendar:
                logger.warning(f'Calendar not found')

            _resp = moveGoogleEvent(
                user, googleEventId, fromCalendar.google_id, toCalendar.google_id
            )
            logger.info(f'Moved event {googleEventId}')

    asyncio.run(syncMoveGoogleEventCalendar())
