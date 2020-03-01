import logging
from fastapi import APIRouter, Depends

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.calendar.sync import syncGoogleCalendar

router = APIRouter()


@router.post('/sync/', response_model={})
async def syncUser(
        user=Depends(get_current_user),
        session=Depends(get_db)):
    logging.info(f'Sync calendar for {user.username}')

    # TODO(winston) this should return list or # of new events.
    syncGoogleCalendar(user.username)

    return {}
