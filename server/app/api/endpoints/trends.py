import enum
from sqlalchemy import text
from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.api.utils.security import get_current_user
from app.db.session import engine
from app.core.logger import logger

DAY_SECONDS = 24 * 60 * 60
WEEK_SECONDS = DAY_SECONDS * 7

router = APIRouter()


class TrendType(enum.Enum):
    LAST_7_DAYS = 1
    LAST_14_DAYS = 2
    LAST_30_DAYS = 3
    LAST_8_WEEKS = 4
    LAST_16_WEEKS = 5
    LAST_52_WEEKS = 6


class TimePeriod(enum.Enum):
    DAY = 'DAY'
    WEEK = 'WEEK'
    MONTH = 'MONTH'


@dataclass
class TrendConfig:
    timePeriod: TimePeriod
    startTime: datetime

    def getTimeSeconds(self):
        if self.timePeriod == TimePeriod.DAY:
            return DAY_SECONDS
        if self.timePeriod == TimePeriod.WEEK:
            return WEEK_SECONDS

        return WEEK_SECONDS


@router.get('/trends/{label_key}')
def getUserTrends(
        label_key: str,
        time_period: str = "WEEK",
        user=Depends(get_current_user)):
    userId = user.id
    logger.info(f'getUserTrends:{userId}')

    trendsConfig = TrendConfig(
        TimePeriod[time_period],
        datetime.now() - timedelta(days=16 * 7))
    logger.info(trendsConfig)

    query = \
        "SELECT\
            sum(EXTRACT(EPOCH FROM (end_time - start_time))),\
            (date_trunc('seconds',\
                (start_time - timestamptz 'epoch') / :seconds) * :seconds + timestamptz 'epoch')\
                    as time_chunk\
        FROM (\
            SELECT\
                event.start_time,\
                event.end_time as end_time,\
                label.key as label\
            FROM event\
            INNER JOIN event_label ON event_label.event_id = event.id\
            INNER JOIN label ON label.id = event_label.label_id\
            WHERE label.key = :label\
            AND event.start_time >= :start_time\
            AND event.user_id = :userId\
        ) as sq\
        GROUP BY time_chunk\
        ORDER BY time_chunk ASC"

    result = engine.execute(text(query),
        seconds=trendsConfig.getTimeSeconds(),
        userId=userId,
        start_time=trendsConfig.startTime,
        label=label_key)

    labels = []
    durations = []
    for row in result:
        duration, date = row
        labels.append(date.strftime('%Y-%m-%d'))
        durations.append(duration / 60.0 / 60.0)

    return {
        'labels': labels,
        'values': durations
    }
