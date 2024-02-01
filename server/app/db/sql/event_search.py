EVENT_SEARCH_QUERY = """
    SELECT id FROM (
        SELECT event.*,
            setweight(to_tsvector('english', event.title), 'A') as doc
        FROM event
        INNER JOIN user_calendar
            ON event.calendar_id = user_calendar.id
        INNER JOIN user_credentials
            ON user_calendar.account_id = user_credentials.id
        WHERE user_credentials.user_id = :userId
        AND event.recurrences is NULL
        AND event.status != 'deleted'
        AND event.start >= :start
        AND event.end <= :end
    ) search
    WHERE search.doc @@ to_tsquery(:query || ':*')
    ORDER BY ts_rank(search.doc, to_tsquery(:query || ':*')) DESC;
"""
