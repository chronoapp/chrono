import enum

from sqlalchemy import text
from fastapi import APIRouter, Depends
from datetime import datetime, timedelta

from app.api.utils.security import get_current_user
from app.db.session import scoped_session
from app.core.logger import logger

DAY_SECONDS = 24 * 60 * 60
WEEK_SECONDS = DAY_SECONDS * 7

router = APIRouter()


class TimePeriod(enum.Enum):
    DAY = 'DAY'
    WEEK = 'WEEK'
    MONTH = 'MONTH'


@router.get('/trends/{labelId}')
def getUserTrends(
    labelId: int, start: str, end: str, time_period: str = "WEEK", user=Depends(get_current_user)
):
    """TODO: start time, end time as"""
    userId = user.id
    logger.info(f'{userId} {time_period}')

    timePeriod = TimePeriod[time_period]
    startTime = datetime.fromisoformat(start)
    endTime = datetime.fromisoformat(end)

    labels, durations = getTrendsDataResult(userId, labelId, startTime, endTime, timePeriod)

    return {'labels': labels, 'values': durations}


def getTrendsDataResult(
    userId: int, labelId: int, startTime: datetime, endTime: datetime, timePeriod: TimePeriod
):
    """Executes the DB query for time spent on the activity label,
    grouped by TimePeriod.
    """
    labels, durations = [], []

    with scoped_session() as session:
        timePeriodValue = timePeriod.value.lower()
        query = """
            with filtered_events as (
                    SELECT
                        event.start,
                        event.end as end,
                        label.key as label
                    FROM event
                    INNER JOIN event_label ON event_label.event_id = event.id
                    INNER JOIN label ON label.id = event_label.label_id
                    WHERE label.id = :labelId\
                    AND event.start >= :start_time\
                    AND event.end <= :end_time\
                    AND event.user_id = :userId\
                )
            SELECT starting,
                coalesce(sum(EXTRACT(EPOCH FROM (e.end - e.start))), 0),
                count(e.start) AS event_count
            FROM generate_series(date_trunc(:time_period, :start_time)
                                , :end_time
                                , interval :time_interval) g(starting)
            LEFT JOIN filtered_events e
                ON e.start > g.starting
                AND e.start <  g.starting + interval :time_interval
            GROUP BY starting
            ORDER BY starting;
        """

        result = session.execute(
            text(query),
            {
                'userId': userId,
                'start_time': startTime,
                'end_time': endTime,
                'labelId': labelId,
                'time_period': timePeriodValue,
                'time_interval': f'1 {timePeriodValue}',
            },
        )

        for row in result:
            date, duration, _ = row
            labels.append(date.strftime('%Y-%m-%d'))
            durations.append(duration / 60.0 / 60.0)

    return labels, durations
