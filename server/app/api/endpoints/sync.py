import logging
from fastapi import APIRouter, Depends

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.sync.google.tasks import syncAllCalendarsTask

router = APIRouter()


@router.post('/sync/')
async def syncUser(user=Depends(get_current_user), session=Depends(get_db)):
    logging.info(f'Sync calendar for {user.id}')

    syncAllCalendarsTask.send(user.id, False)

    return {}
