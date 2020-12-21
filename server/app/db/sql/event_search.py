EVENT_SEARCH_QUERY = """
    SELECT id FROM (
        SELECT event.*,
            setweight(to_tsvector('english', event.title), 'A') ||
            setweight(to_tsvector('english', coalesce(event.description, '')), 'B') as doc
        FROM event
        WHERE event.user_id = :userId
        AND event.recurrences is NULL
    ) search
    WHERE search.doc @@ to_tsquery(:query || ':*')
    ORDER BY ts_rank(search.doc, to_tsquery(:query || ':*')) DESC
    LIMIT :limit;
"""
