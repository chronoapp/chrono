import logging
from fastapi import APIRouter, Depends

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.calendar.sync import syncAllEvents

router = APIRouter()


@router.post('/sync/')
async def syncUser(user=Depends(get_current_user), session=Depends(get_db)):
    logging.info(f'Sync calendar for {user.id}')

    # TODO(winston) this should return list or # of new events.
    syncAllEvents(user.id)

    return {}
