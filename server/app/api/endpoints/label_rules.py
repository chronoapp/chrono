from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import Label, LabelRule, User, Event
from app.core.logger import logger
"""Rules for each event.
"""

router = APIRouter()


class LabelRuleVM(BaseModel):
    text: str
    label_id: str

    class Config:
        orm_mode = True


class LabelRuleInDBVM(LabelRuleVM):
    user_id: int
    id: int


@router.get('/label_rules/', response_model=List[LabelRuleInDBVM])
async def getLabelRules(label_id: int,
                        text: str = '',
                        user=Depends(get_current_user),
                        session=Depends(get_db)):
    if text:
        return user.label_rules.filter(and_(LabelRule.text == text, LabelRule.id == label_id)).all()
    else:
        return user.label_rules.all()


@router.put('/label_rules/', response_model=LabelRuleInDBVM)
async def putLabel(labelRule: LabelRuleVM, user=Depends(get_current_user), session=Depends(get_db)):

    labelDb = user.labels.filter_by(id=labelRule.label_id).first()
    labelRuleDb = user.label_rules.filter_by(label_id=labelRule.label_id,
                                             text=labelRule.text).first()

    if not labelRuleDb:
        labelRuleDb = LabelRule(labelRule.text)
        labelRuleDb.user_id = user.id
        labelDb.rules.append(labelRuleDb)
    else:
        labelRuleDb.text = labelRule.text

    # applies the rule to all previous events
    for event in user.events.filter(Event.title.ilike(labelRule.text)):
        if not labelDb in event.labels:
            event.labels.append(labelDb)

    session.commit()
    session.refresh(labelRuleDb)

    return labelRuleDb
