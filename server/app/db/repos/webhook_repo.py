from uuid import UUID

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from app.core.logger import logger
from app.core import config
from app.db.models import Webhook, User, UserCalendar

from app.sync.google import gcal
from googleapiclient.errors import HttpError
from .exceptions import RepoError

EXPIRING_SOON_DAYS = 3


class WebhookRepository:
    def __init__(self, session: Session):
        self.session = session

    def getWebhookByChannelId(self, channelId: str) -> Webhook | None:
        stmt = (
            select(Webhook).where(Webhook.id == channelId).options(selectinload(Webhook.calendar))
        )
        webhook = (self.session.execute(stmt)).scalar()

        return webhook

    def getUserWebhooks(self, userId: int) -> list[Webhook]:
        webhooks = (
            (
                self.session.execute(
                    select(Webhook).join(UserCalendar).join(User).where(User.id == userId)
                )
            )
            .scalars()
            .all()
        )

        return list(webhooks)

    def getCalendarEventsWebhook(self, calendarId: UUID) -> Webhook | None:
        stmt = select(Webhook).where(
            Webhook.calendar_id == calendarId, Webhook.type == 'calendar_events'
        )
        webhook = (self.session.execute(stmt)).scalar()

        return webhook

    def getCalendarListWebhook(self, user: User) -> Webhook | None:
        stmt = (
            select(Webhook).where(Webhook.user_id == user.id).where(Webhook.type == 'calendar_list')
        )
        webhook = (self.session.execute(stmt)).scalar()

        return webhook

    def createCalendarListWebhook(self, user: User) -> Webhook | None:
        """Create a webhook to watch for user calendar list updates."""
        if not config.API_URL:
            raise RepoError(f'No API URL specified.')

        webhook = self.getCalendarListWebhook(user)
        if webhook:
            return webhook

        try:
            webhookUrl = f'{config.API_URL}{config.API_V1_STR}/webhooks/google_calendar_list'
            resp = gcal.addCalendarListWebhook(user, webhookUrl)
            expiration = resp.get('expiration')

            webhook = Webhook(
                resp.get('id'),
                resp.get('resourceId'),
                resp.get('resourceUri'),
                int(expiration),
                'calendar_list',
            )
            webhook.user = user
            self.session.add(webhook)
            self.session.commit()

            return webhook

        except HttpError as e:
            logger.error(e.reason)
            return None

    def createCalendarEventsWebhook(self, calendar: UserCalendar) -> Webhook | None:
        """Create a webhook for the calendar to watche for event updates.
        Only creates one webhook per calendar.
        """
        if not config.API_URL:
            raise RepoError(f'No API URL specified.')

        webhook = self.getCalendarEventsWebhook(calendar.id)
        if webhook:
            return webhook

        try:
            webhookUrl = f'{config.API_URL}{config.API_V1_STR}/webhooks/google_events'
            resp = gcal.addCalendarEventsWebhook(calendar, webhookUrl)
            expiration = resp.get('expiration')

            webhook = Webhook(
                resp.get('id'),
                resp.get('resourceId'),
                resp.get('resourceUri'),
                int(expiration),
                'calendar_events',
            )
            webhook.calendar = calendar
            webhook.user = calendar.user
            self.session.add(webhook)
            self.session.commit()

            return webhook

        except HttpError as e:
            logger.error(e.reason)
            return None

    def refreshExpiringWebhooks(self):
        """Refreshes all webhooks that are about to expire."""
        logger.debug(f'Refreshing Webhooks...')
        for webhook in self._getExpiringWebhooks():
            isExpiring = webhook.expiration <= datetime.now(timezone.utc) + timedelta(days=3)
            if isExpiring:
                logger.debug(f'Refresh Webhook {webhook.id}.')
                self.cancelCalendarEventsWebhook(webhook.calendar.user, webhook)
                self.createCalendarEventsWebhook(webhook.calendar)

    def cancelCalendarEventsWebhook(self, user: User, webhook: Webhook):
        try:
            gcal.removeWebhook(user, webhook.id, webhook.resource_id)
        except HttpError as e:
            logger.error(e.reason)

        self.session.delete(webhook)

    def _getExpiringWebhooks(self) -> list[Webhook]:
        expiresDt = datetime.now() + timedelta(days=EXPIRING_SOON_DAYS)

        stmt = (
            select(Webhook)
            .where(Webhook.expiration <= expiresDt)
            .options(selectinload(Webhook.calendar).selectinload(UserCalendar.user))
        )

        webhooks = (self.session.execute(stmt)).scalars().all()

        return list(webhooks)
