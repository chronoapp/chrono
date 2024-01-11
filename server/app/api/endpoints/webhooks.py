from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.utils.db import get_db
from app.db.repos.webhook_repo import WebhookRepository
from app.sync.google.tasks import syncCalendarTask


router = APIRouter()


@router.post('/webhooks/google_events')
async def updateGoogleEvent(request: Request, session: Session = Depends(get_db)):
    """Watches for updates from google calendar and does an incremental sync of the calendar."""

    channelId = request.headers.get('x-goog-channel-id')
    if not channelId:
        return {}

    webhookRepo = WebhookRepository(session)
    webhook = webhookRepo.getWebhookByChannelId(channelId)

    if webhook:
        syncCalendarTask.send(webhook.calendar.user_id, webhook.calendar_id, False)

    return {}
