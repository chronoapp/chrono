from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.utils.db import get_db
from app.db.models import Webhook
from app.calendar.google import syncCalendar

router = APIRouter()


@router.post('/webhooks/google_events')
async def updateGoogleEvent(request: Request, session: Session = Depends(get_db)):
    """Watches for updates from google calendar.
    """
    print('Update Events')

    channelId = request.headers.get('x-goog-channel-id')
    resourceId = request.headers.get('x-goog-resource-id')

    print(f'channelId: {channelId}, resourceId: {resourceId}')
    webhook = session.query(Webhook).filter_by(id=channelId).one_or_none()
    if webhook:
        syncCalendar(webhook.calendar, session)

    return {}
