from uuid import UUID

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from app.core.logger import logger
from app.core import config
from app.db.models import Webhook, User, UserCalendar, UserAccount

from app.sync.google import gcal
from googleapiclient.errors import HttpError
from .exceptions import RepoError

EXPIRING_SOON_DAYS = 3


class WebhookRepository:
    def __init__(self, session: Session):
        self.session = session

    def getWebhookByChannelId(self, channelId: str) -> Webhook | None:
        """Gets a webhook by google's channel ID."""
        stmt = (
            select(Webhook).where(Webhook.id == channelId).options(selectinload(Webhook.calendar))
        )
        webhook = (self.session.execute(stmt)).scalar()

        return webhook

    def getUserWebhooks(self, userId: UUID) -> list[Webhook]:
        """Gets all webhooks for a user."""
        stmt = select(Webhook).join(UserAccount).where(UserAccount.user_id == userId)
        webhooks = (self.session.execute(stmt)).scalars().all()

        return list(webhooks)

    def getCalendarEventsWebhook(self, calendarId: UUID) -> Webhook | None:
        """Gets the webhook for updating a calendar's events."""
        stmt = select(Webhook).where(
            Webhook.calendar_id == calendarId, Webhook.type == 'calendar_events'
        )
        webhook = (self.session.execute(stmt)).scalar()

        return webhook

    def getCalendarListWebhook(self, account: UserAccount) -> Webhook | None:
        """Gets the webhook for updating a user's calendar list."""
        stmt = (
            select(Webhook)
            .where(Webhook.account_id == account.id)
            .where(Webhook.type == 'calendar_list')
        )
        webhook = (self.session.execute(stmt)).scalar()

        return webhook

    def createCalendarListWebhook(self, account: UserAccount) -> Webhook | None:
        """Create a webhook to watch for user calendar list updates."""
        if not config.API_URL:
            raise RepoError('No API URL specified.')

        webhook = self.getCalendarListWebhook(account)
        if webhook:
            return webhook

        try:
            webhookUrl = f'{config.API_URL}/webhooks/google_calendar_list'
            resp = gcal.addCalendarListWebhook(account, webhookUrl)
            expiration = resp.get('expiration')

            webhook = Webhook(
                resp.get('id'),
                resp.get('resourceId'),
                resp.get('resourceUri'),
                int(expiration),
                'calendar_list',
            )
            webhook.account = account
            self.session.add(webhook)
            self.session.commit()

            return webhook

        except HttpError as e:
            logger.error(f'Error adding calendar list webhook: {e.reason}')
            return None

    def createCalendarEventsWebhook(
        self, account: UserAccount, calendar: UserCalendar
    ) -> Webhook | None:
        """Create a webhook for the calendar to watche for event updates.
        Only creates one webhook per calendar.
        """
        if not config.API_URL:
            raise RepoError('No API URL specified.')

        webhook = self.getCalendarEventsWebhook(calendar.id)
        if webhook:
            return webhook

        try:
            webhookUrl = f'{config.API_URL}/webhooks/google_events'
            resp = gcal.addCalendarEventsWebhook(calendar, webhookUrl)
            expiration = resp.get('expiration')

            webhook = Webhook(
                resp.get('id'),
                resp.get('resourceId'),
                resp.get('resourceUri'),
                int(expiration),
                'calendar_events',
            )
            webhook.account = account
            webhook.calendar = calendar
            self.session.add(webhook)
            self.session.commit()

            return webhook

        except HttpError as e:
            reason = isinstance(e.error_details, list) and e.error_details[0].get('reason')
            # If the calendar is not pushable, we don't need to log the error.
            # TODO: Is there another way to check if the calendar is not pushable?
            if reason != 'pushNotSupportedForRequestedResource':
                logger.error(f'Error adding webhook for {calendar.summary}: {e.reason}')

            return None

    def recreateAllWebhooks(self, user: User):
        """Delete and re-create all webhooks."""
        for webhook in self._getAllWebhooks(user):
            # Cancel the existing webhook
            self.cancelWebhook(webhook)

        for account in user.accounts:
            # Create calendar list webhook for each account
            self.createCalendarListWebhook(account)

            # Create calendar events webhooks for each calendar in the account
            for calendar in account.calendars:
                self.createCalendarEventsWebhook(account, calendar)

    def cancelWebhook(self, webhook: Webhook):
        try:
            gcal.removeWebhook(webhook.account, webhook.id, webhook.resource_id)
        except HttpError as e:
            logger.error(e.reason)

        self.session.delete(webhook)
        self.session.commit()

    def _getAllWebhooks(self, user: User) -> list[Webhook]:
        stmt = select(Webhook).join(UserAccount).where(UserAccount.user_id == user.id)
        webhooks = (self.session.execute(stmt)).scalars().all()

        return list(webhooks)

    def _getExpiringWebhooks(self, user: User) -> list[Webhook]:
        expiresDt = datetime.now() + timedelta(days=EXPIRING_SOON_DAYS)

        stmt = (
            select(Webhook)
            .join(UserAccount)
            .where(Webhook.expiration <= expiresDt)
            .where(UserAccount.user_id == user.id)
        )

        webhooks = (self.session.execute(stmt)).scalars().all()

        return list(webhooks)
