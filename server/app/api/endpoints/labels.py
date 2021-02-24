from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, validator

from sqlalchemy.orm import Session
from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import Label, User
from app.core.logger import logger

router = APIRouter()


class LabelVM(BaseModel):
    title: str
    color_hex: str
    key: Optional[str]
    parent_id: Optional[int]
    position: int

    @validator('title')
    def titleIsNonEmpty(cls, title: str):
        if not title:
            raise ValueError('Title not specified.')

        return title

    class Config:
        orm_mode = True


class LabelInDbVM(LabelVM):
    id: int


def createOrUpdateLabel(user: User, labelId: Optional[int], label: LabelVM) -> Label:
    labelDb = None
    if labelId:
        labelDb = user.labels.filter_by(id=labelId).one_or_none()

    if not labelDb:
        labelDb = Label(label.title, label.color_hex)
        user.labels.append(labelDb)

    labelDb.color_hex = label.color_hex
    labelDb.title = label.title
    labelDb.position = label.position
    labelDb.parent_id = label.parent_id

    return labelDb


def combineLabels(labels: List[Label]) -> List[Label]:
    """Children overrides parents. Maintains the same order."""
    labelsToRemove = set()
    labelMap = {l.id: l for l in labels}

    for l in labels:
        parentId = l.parent_id
        while parentId in labelMap:
            labelsToRemove.add(parentId)
            parent = labelMap[parentId]
            del labelMap[parentId]
            parentId = parent.id

    res = [l for l in labels if l.id not in labelsToRemove]
    return res


@router.get('/labels/', response_model=List[LabelInDbVM])
async def getLabels(user=Depends(get_current_user), session=Depends(get_db)):
    return user.labels.order_by(Label.title).all()


@router.post('/labels/', response_model=LabelInDbVM)
async def createLabel(
    label: LabelVM, user=Depends(get_current_user), session=Depends(get_db)
) -> Label:
    labelDb = Label(label.title, label.color_hex)
    user.labels.append(labelDb)
    session.commit()

    return labelDb


@router.put('/labels/', response_model=List[LabelInDbVM])
async def putLabels(
    labels: List[LabelInDbVM], user=Depends(get_current_user), session=Depends(get_db)
):
    """TODO: Bulk update with one query."""
    updatedLabels = [createOrUpdateLabel(user, label.id, label) for label in labels]
    session.commit()

    return updatedLabels


@router.put('/labels/{labelId}', response_model=LabelInDbVM)
async def putLabel(
    label: LabelInDbVM,
    labelId: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Label:
    labelDb = createOrUpdateLabel(user, labelId, label)
    session.commit()
    session.refresh(labelDb)

    return labelDb


@router.delete('/labels/{labelId}', response_model=LabelInDbVM)
async def deleteLabel(
    labelId: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Label:
    label = session.query(Label).filter_by(id=labelId).one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    else:
        session.delete(label)
        session.commit()
        return label
