import uuid

from typing import Literal
from sqlalchemy import text
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta

from app.api.utils.security import get_current_user
from app.api.utils.db import get_db

from app.db.models import User, Label
from app.db.sql.get_trends import TRENDS_QUERY
from app.core.logger import logger

DAY_SECONDS = 24 * 60 * 60
WEEK_SECONDS = DAY_SECONDS * 7

router = APIRouter()

TimePeriod = Literal['DAY', 'WEEK', 'MONTH']


@router.get('/plugins/trends/{labelId}')
async def getUserTrends(
    labelId: uuid.UUID,
    start: str,
    end: str,
    time_period: TimePeriod = "WEEK",
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """TODO: start time, end time as"""
    userId = user.id
    logger.info(f'{userId} {time_period}')

    try:
        startTime = datetime.fromisoformat(start)
        endTime = datetime.fromisoformat(end)
        labels, durations = getTrendsDataResult(
            user, labelId, startTime, endTime, time_period, session
        )

        return {'labels': labels, 'values': durations}

    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


def getSubtreeLabelIds(user: User, labelId: uuid.UUID) -> list[uuid.UUID]:
    """Gets all Label IDs in the subtree. Could also do this in SQL,
    but this should be fast when we have O(100) labels.
    """
    labels: list[Label] = user.labels

    labelMap = {l.id: l for l in labels}
    if labelId not in labelMap:
        raise ValueError(f'Invalid Label {labelId}')

    childIdsMap: dict[uuid.UUID, list[uuid.UUID]] = {}
    for l in labels:
        if l.parent_id is None:
            continue

        if l.parent_id in childIdsMap:
            childIdsMap[l.parent_id].append(l.id)
        else:
            childIdsMap[l.parent_id] = [l.id]

    labelIds: list[uuid.UUID] = []
    queue = [labelMap[labelId]]

    while len(queue) > 0:
        label = queue.pop()
        labelIds.append(label.id)

        if label.id in childIdsMap:
            if childIds := childIdsMap[label.id]:
                for childId in childIds:
                    queue.append(labelMap[childId])

    return labelIds


def getInterval(period: TimePeriod) -> str:
    """Returns the postgres interval."""
    if period == 'DAY':
        return '1 day'
    elif period == 'WEEK':
        return '1 week'
    elif period == 'MONTH':
        return '1 month'
    else:
        raise ValueError('Period not found.')


def getRoundedDate(dt: datetime, period: TimePeriod) -> datetime:
    """Rounds the date to the nearest period."""
    if period == 'DAY':
        return dt
    elif period == 'WEEK':
        return dt - timedelta(days=(dt.weekday() + 1) % 7)
    elif period == 'MONTH':
        return dt.replace(day=1)
    else:
        raise ValueError('Period not found.')


def getNextPeriodDt(dt: datetime, period: TimePeriod) -> datetime:
    """Gets the next timeperiod for the given datetime."""
    if period == 'DAY':
        return dt + timedelta(days=1)
    elif period == 'WEEK':
        return dt + timedelta(days=7)
    elif period == 'MONTH':
        return dt + timedelta(days=30)
    else:
        raise ValueError('Period not found.')


def getTrendsDataResult(
    user: User,
    labelId: uuid.UUID,
    startTime: datetime,
    endTime: datetime,
    timePeriod: TimePeriod,
    session: Session,
):
    """Executes the DB query for time spent on the activity label,
    grouped by TimePeriod.

    TODO: Expand recurring events and merge.
    """
    startTime = getRoundedDate(startTime, timePeriod)
    endTimePlusOneInterval = getNextPeriodDt(endTime, timePeriod)

    userId = user.id
    timezone = user.timezone
    labels, durations = [], []

    labelIds = getSubtreeLabelIds(user, labelId)
    labelIdsFilter = ' OR '.join([f'label.id = \'{labelId}\'' for labelId in labelIds])
    interval = getInterval(timePeriod)

    query = TRENDS_QUERY.format(labelIdsFilter=labelIdsFilter, interval=interval)

    result = session.execute(
        text(query),
        {
            'userId': userId,
            'start_time': startTime,
            'end_time': endTimePlusOneInterval,
            'interval_end_time': endTime,
            'time_period': timePeriod,
            'timezone': timezone,
            'timezone_end': timezone,
        },
    )

    for row in result:
        date, duration, _ = row
        labels.append(date.strftime('%Y-%m-%d'))
        durations.append(duration / 60.0 / 60.0)

    return labels, durations
