from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import Label, LabelRule, User
from app.core.logger import logger

router = APIRouter()


class LabelRuleVM(BaseModel):
    text: str
    user_id: str
    label_id: str


class LabelRuleInDBVM(LabelRuleVM):
    id: int


@router.get('/label_rules/', response_model=List[LabelRuleInDBVM])
async def getLabels(
        text: str = '',
        user=Depends(get_current_user),
        session=Depends(get_db)):

    if text:
        return user.label_rules.filter(LabelRule.text == text).all()
    else:
        return user.label_rules.all()
