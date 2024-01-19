from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.utils.db import get_db
from app.db.repos.webhook_repo import WebhookRepository
from app.sync.google.tasks import syncCalendarTask, syncAllCalendarsTask

router = APIRouter()

"""Watches for the following updates to sync from google calendar:
1) Calendar List
2) Calendar Events
"""


@router.post('/webhooks/google_calendar_list')
async def updateGoogleCalendarList(request: Request, session: Session = Depends(get_db)):
    """Watches for updates from google calendar sync the full calendar list."""

    channelId = request.headers.get('x-goog-channel-id')
    if not channelId:
        return {}

    webhookRepo = WebhookRepository(session)
    webhook = webhookRepo.getWebhookByChannelId(channelId)

    if webhook:
        syncAllCalendarsTask.send(webhook.user_id, False)

    return {}


@router.post('/webhooks/google_events')
async def updateGoogleEvent(request: Request, session: Session = Depends(get_db)):
    """Watches for updates from google calendar and does an incremental sync of the calendar."""

    channelId = request.headers.get('x-goog-channel-id')
    if not channelId:
        return {}

    webhookRepo = WebhookRepository(session)
    webhook = webhookRepo.getWebhookByChannelId(channelId)

    if webhook:
        syncCalendarTask.send(webhook.user_id, webhook.calendar_id, False)

    return {}
