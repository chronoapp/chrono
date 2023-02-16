from typing import Optional

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload, Session

from app.core.logger import logger
from app.core import config
from app.db.models import Webhook, User, UserCalendar

from app.sync.google.gcal import getCalendarService, addEventsWebhook
from googleapiclient.errors import HttpError

EXPIRING_SOON_DAYS = 3
EVENTS_WEBHOOK_TTL_DAYS = 30
EVENTS_WEBHOOK_TTL_SECONDS = timedelta(days=EVENTS_WEBHOOK_TTL_DAYS).total_seconds()


class WebhookRepository:
    def __init__(self, session: Session):
        self.session = session

    def getExpiringWebhooks(self) -> list[Webhook]:
        expiresDt = datetime.now() - timedelta(days=EXPIRING_SOON_DAYS)

        stmt = (
            select(Webhook)
            .where(Webhook.expiration >= expiresDt)
            .options(selectinload(Webhook.calendar).selectinload(UserCalendar.user))
        )

        webhooks = (self.session.execute(stmt)).scalars().all()

        return list(webhooks)

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

    def createCalendarWebhook(self, calendar: UserCalendar) -> Optional[Webhook]:
        """Create a webhook for the calendar to watche for event updates.
        Only creates one webhook per calendar.
        """
        if not config.API_URL:
            logger.error(f'No API URL specified.')
            return None

        stmt = select(Webhook).where(Webhook.calendar_id == calendar.id)
        webhook = (self.session.execute(stmt)).scalar()

        if webhook:
            print(f'{webhook.expiration}')
            logger.info(f'Webhook exists.')
            return webhook

        try:
            resp = addEventsWebhook(calendar, EVENTS_WEBHOOK_TTL_SECONDS)
            expiration = resp.get('expiration')
            webhook = Webhook(
                resp.get('id'), resp.get('resourceId'), resp.get('resourceUri'), int(expiration)
            )
            webhook.calendar = calendar
            self.session.add(webhook)
            self.session.commit()

            return webhook

        except HttpError as e:
            logger.error(e.reason)
            return None

    def cancelCalendarWebhook(self, user: User, webhook: Webhook):
        body = {'resourceId': webhook.resource_id, 'id': webhook.id}

        try:
            _resp = getCalendarService(user).channels().stop(body=body).execute()
        except HttpError as e:
            logger.error(e.reason)

        self.session.delete(webhook)

    def refreshExpiringWebhooks(self):
        """Refreshes all webhooks that are about to expire."""
        logger.debug(f'Refreshing Webhooks...')
        for webhook in self.getExpiringWebhooks():
            isExpiring = webhook.expiration - timedelta(days=3) < datetime.now(timezone.utc)
            if isExpiring:
                logger.debug(f'Refresh Webhook {webhook.id}.')
                self.cancelCalendarWebhook(webhook.calendar.user, webhook)
                self.createCalendarWebhook(webhook.calendar)
