from typing import List, Optional
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
    parent_id: Optional[int]
    position: int

    class Config:
        orm_mode = True


class LabelInDbVM(LabelVM):
    id: int


def createOrUpdateLabel(user: User, labelId: int, label: LabelVM) -> Label:
    labelDb = user.labels.filter_by(id=labelId).one_or_none()
    if not labelDb:
        labelDb = Label(label.title, label.key)

    labelDb.title = label.title
    labelDb.color_hex = label.color_hex
    labelDb.position = label.position
    labelDb.parent_id = label.parent_id

    return labelDb


@router.get('/labels/', response_model=List[LabelInDbVM])
async def getLabels(user=Depends(get_current_user), session=Depends(get_db)):
    return user.labels.order_by(Label.title).all()


@router.put('/labels/', response_model=List[LabelInDbVM])
async def putLabels(labels: List[LabelInDbVM],
                    user=Depends(get_current_user),
                    session=Depends(get_db)):
    """TODO: Bulk update with one query.
    """
    updatedLabels = [createOrUpdateLabel(user, label.id, label) for label in labels]
    session.commit()

    return updatedLabels


@router.put('/labels/{labelId}', response_model=LabelInDbVM)
async def putLabel(
    label: LabelInDbVM,
    labelId: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db)) -> Label:

    labelDb = createOrUpdateLabel(user, labelId, label)
    session.commit()
    session.refresh(labelDb)

    return labelDb
