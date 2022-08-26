from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.utils.db import get_db
from app.db.models import Webhook
from app.sync.google.tasks import syncCalendarTask

router = APIRouter()


@router.post('/webhooks/google_events')
async def updateGoogleEvent(request: Request, session: Session = Depends(get_db)):
    """Watches for updates from google calendar and does an incremental sync of the calendar."""

    channelId = request.headers.get('x-goog-channel-id')
    stmt = select(Webhook).where(Webhook.id == channelId).options(selectinload(Webhook.calendar))
    webhook = (await session.execute(stmt)).scalar()

    if webhook:
        syncCalendarTask.send(webhook.calendar.user_id, webhook.calendar_id, False)

    return {}
