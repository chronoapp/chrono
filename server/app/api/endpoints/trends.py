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


@router.get('/trends/{label_key}')
def getUserTrends(label_key: str, time_period: str = "WEEK", user=Depends(get_current_user)):
    userId = user.id
    logger.info(f'{userId, time_period}')

    timePeriod = TimePeriod[time_period]
    endTime = datetime.now()

    # TODO: Client sends predefined values.
    if timePeriod == TimePeriod.MONTH:
        diff = timedelta(days=12 * 365 / 12)
    else:
        diff = timedelta(days=12 * 7)

    startTime = endTime - diff
    labels, durations = getTrendsDataResult(userId, label_key, startTime, endTime, timePeriod)

    return {'labels': labels, 'values': durations}


def getTrendsDataResult(userId: int, label: str, startTime: datetime, endTime: datetime,
                        timePeriod: TimePeriod):
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
                    WHERE label.key = :label\
                    AND event.start >= :start_time\
                    AND event.end <= :end_time\
                    AND event.user_id = :userId\
                )
            SELECT starting,
                coalesce(sum(EXTRACT(EPOCH FROM (e.end - e.start))), 0),
                count(e.start) AS event_count
            FROM generate_series(date_trunc('TIME_PERIOD', :start_time)
                                , :end_time
                                , interval '1 TIME_PERIOD') g(starting)
            LEFT JOIN filtered_events e
                ON e.start > g.starting
                AND e.start <  g.starting + interval '1 TIME_PERIOD'
            GROUP BY starting
            ORDER BY starting;
        """.replace('TIME_PERIOD', timePeriodValue)

        result = session.execute(text(query), {
            'userId': userId,
            'start_time': startTime,
            'end_time': endTime,
            'label': label
        })

        for row in result:
            date, duration, _ = row
            labels.append(date.strftime('%Y-%m-%d'))
            durations.append(duration / 60.0 / 60.0)

    return labels, durations
