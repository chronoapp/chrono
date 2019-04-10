from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

router = APIRouter()


class LabelVM(BaseModel):
    id: int
    key: str
    title: str


@router.get('/labels/', response_model=List[LabelVM])
async def getLabels(
        user=Depends(get_current_user),
        session=Depends(get_db)):

    return user.labels.all()
