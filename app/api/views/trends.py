from flask import request, jsonify
from sqlalchemy import text
import logging

from api import app
from api.session import engine
from api.utils.middleware import authorized


@app.route('/trends')
@authorized
def getUserTrends():
    """Gets trends for a label for last N days.
    """
    userId = request.environ.get('user').id
    logging.info(f'getUserTrends:{userId}')

    daySeconds = 24 * 60 * 60
    weekSeconds = daySeconds * 7
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
            AND event.user_id = :userId\
        ) as sq\
        GROUP BY time_chunk\
        ORDER BY time_chunk ASC"

    result = engine.execute(text(query),
        seconds=weekSeconds,
        userId=userId,
        label='work')

    labels = []
    durations = []
    for row in result:
        duration, date = row
        labels.append(date.strftime('%Y-%m-%d'))
        durations.append(duration / 60.0 / 60.0)

    return jsonify({
        'labels': labels,
        'values': durations
    })
