import uuid

from typing import List, Optional, Sequence
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user

from app.db.models import Label, LabelRule, User

"""Rules for each event.
"""

router = APIRouter()


class LabelRuleVM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text: str
    label_id: uuid.UUID


class LabelRuleInDBVM(LabelRuleVM):
    user_id: uuid.UUID
    id: uuid.UUID


@router.get('/label_rules/', response_model=List[LabelRuleInDBVM])
async def getLabelRules(
    label_id: uuid.UUID,
    text: str = '',
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Sequence[LabelRule]:
    if text:
        result = session.execute(
            select(LabelRule).where(
                LabelRule.user_id == user.id, LabelRule.text == text, LabelRule.label_id == label_id
            )
        )
        return result.scalars().all()
    else:
        result = session.execute(
            select(LabelRule).where(
                LabelRule.user_id,
            )
        )
        return result.scalars().all()


@router.put('/label_rules/', response_model=LabelRuleInDBVM)
async def putLabel(
    labelRule: LabelRuleVM,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> LabelRule:
    labelDb: Optional[Label] = (
        session.execute(
            select(Label).where(and_(User.id == user.id, Label.id == labelRule.label_id))
        )
    ).scalar()

    if not labelDb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    result = session.execute(
        select(LabelRule).where(
            LabelRule.user_id == user.id,
            LabelRule.label_id == labelRule.label_id,
            LabelRule.text == labelRule.text,
        )
    )
    labelRuleDb = result.scalar()

    if not labelRuleDb:
        labelRuleDb = LabelRule(labelRule.text)
        labelRuleDb.user_id = user.id
        labelDb.rules.append(labelRuleDb)
    else:
        labelRuleDb.text = labelRule.text

    session.refresh(labelRuleDb)

    return labelRuleDb
