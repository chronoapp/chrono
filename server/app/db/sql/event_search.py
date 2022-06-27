EVENT_SEARCH_QUERY = """
    SELECT id FROM (
        SELECT event.*,
            setweight(to_tsvector('english', event.title), 'A') ||
            setweight(to_tsvector('english', coalesce(event.description, '')), 'B') as doc
        FROM event
        INNER JOIN user_calendar ON event.calendar_id = user_calendar.id
        AND event.recurrences is NULL
        AND event.status != 'deleted'
        AND user_calendar.user_id = :userId
    ) search
    WHERE search.doc @@ to_tsquery(:query || ':*')
    ORDER BY ts_rank(search.doc, to_tsquery(:query || ':*')) DESC
    LIMIT :limit;
"""
