import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from sqlalchemy.orm import Session

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import Label, User
from app.db.repos.user_repo import UserRepository

router = APIRouter()


class LabelVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    color_hex: str
    key: str | None = None
    parent_id: uuid.UUID | None = None
    position: int | None = None


class LabelInDbVM(LabelVM):
    id: uuid.UUID


def createOrUpdateLabel(
    user: User, labelId: uuid.UUID | None, label: LabelVM, session: Session
) -> Label:
    userRepo = UserRepository(session)

    labelDb = userRepo.getLabel(user.id, labelId)
    if not labelDb:
        labelDb = Label(label.title, label.color_hex)
        user.labels.append(labelDb)

    labelDb.color_hex = label.color_hex
    labelDb.title = label.title
    labelDb.position = label.position
    labelDb.parent_id = label.parent_id

    return labelDb


def combineLabels(labels: list[Label]) -> list[Label]:
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


@router.get('/labels/', response_model=list[LabelInDbVM])
async def getLabels(user=Depends(get_current_user), session=Depends(get_db)):
    userRepo = UserRepository(session)
    labels = userRepo.getLabels(user.id)

    return labels


@router.post('/labels/', response_model=LabelInDbVM)
async def createLabel(
    label: LabelVM, user=Depends(get_current_user), session=Depends(get_db)
) -> Label:
    labelDb = Label(label.title, label.color_hex)
    user.labels.append(labelDb)
    user.labels.reorder()

    session.commit()

    return labelDb


@router.put('/labels/', response_model=list[LabelInDbVM])
async def putLabels(
    labels: list[LabelInDbVM], user=Depends(get_current_user), session=Depends(get_db)
):
    """TODO: Bulk update with one query."""
    updatedLabels = [createOrUpdateLabel(user, label.id, label, session) for label in labels]
    session.commit()

    return updatedLabels


@router.put('/labels/{labelId}', response_model=LabelInDbVM)
async def putLabel(
    label: LabelInDbVM,
    labelId: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Label:
    labelDb = createOrUpdateLabel(user, labelId, label, session)
    session.commit()
    session.refresh(labelDb)

    return labelDb


@router.delete('/labels/{labelId}', response_model=LabelInDbVM)
async def deleteLabel(
    labelId: uuid.UUID, user: User = Depends(get_current_user), session: Session = Depends(get_db)
) -> Label:
    """
    TODO: Handle delete subtree.
    TODO: Fix positions, since Sqlalchemy ORM doesn't support deletes yet.
    """
    userRepo = UserRepository(session)
    label = userRepo.getLabel(user.id, labelId)

    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    else:
        userRepo.deleteLabel(user.id, labelId)

        return label
