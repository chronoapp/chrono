from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from sqlalchemy.orm import Session
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import Label, User
from app.core.logger import logger

router = APIRouter()


class LabelVM(BaseModel):
    key: str
    title: str
    color_hex: str


@router.get('/labels/', response_model=List[LabelVM])
async def getLabels(
        user=Depends(get_current_user),
        session=Depends(get_db)):

    return user.labels.order_by(Label.title).all()


@router.put('/labels/{label_key}', response_model=LabelVM)
async def putLabel(
        label: LabelVM,
        label_key: str,
        user: User = Depends(get_current_user),
        session: Session = Depends(get_db)):

    logger.info(label)
    labelDb = user.labels.filter_by(key=label_key).first()
    logger.info(labelDb)

    if not labelDb:
        labelDb = Label(label.title, label.key, label.color_hex)
    else:
        labelDb.title = label.title
        labelDb.color_hex = label.color_hex

    session.commit()
    session.refresh(labelDb)

    return labelDb
