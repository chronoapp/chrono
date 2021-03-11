from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.utils.db import get_db
from app.api.utils.security import get_current_user
from app.db.models import Label, LabelRule, User, Event
from app.core.logger import logger

"""Rules for each event.
"""

router = APIRouter()


class LabelRuleVM(BaseModel):
    text: str
    label_id: int

    class Config:
        orm_mode = True


class LabelRuleInDBVM(LabelRuleVM):
    user_id: int
    id: int


@router.get('/label_rules/', response_model=List[LabelRuleInDBVM])
async def getLabelRules(
    label_id: int,
    text: str = '',
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if text:
        result = await session.execute(
            select(LabelRule).where(
                LabelRule.user_id == user.id, LabelRule.text == text, LabelRule.label_id == label_id
            )
        )
        return result.scalars().all()
    else:
        result = await session.execute(
            select(LabelRule).where(
                LabelRule.user_id,
            )
        )
        return result.scalars().all()


@router.put('/label_rules/', response_model=LabelRuleInDBVM)
async def putLabel(
    labelRule: LabelRuleVM, user=Depends(get_current_user), session: AsyncSession = Depends(get_db)
):
    result = await session.execute(
        select(Label).where(and_(User.id == user.id, Label.id == labelRule.label_id))
    )
    labelDb = result.scalar()

    result = await session.execute(
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

    # applies the rule to all previous events
    result = await session.execute(
        select(Event)
        .where(Event.user_id == user.id, Event.title.ilike(labelRule.text))
        .options(
            selectinload(Event.labels),
        )
    )
    events = result.scalars()

    for event in events:
        if not labelDb in event.labels:
            event.labels.append(labelDb)

    await session.commit()
    await session.refresh(labelRuleDb)

    return labelRuleDb
