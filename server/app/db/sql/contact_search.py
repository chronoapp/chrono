CONTACT_SEARCH_QUERY = """
    SELECT id FROM (
        SELECT contact.*,
            setweight(to_tsvector('english', coalesce(contact.first_name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(contact.last_name, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(contact.email_address, '')), 'C') as doc
        FROM contact
        WHERE contact.user_id = :userId
    ) search
    WHERE search.doc @@ to_tsquery(:query || ':*')
    ORDER BY ts_rank(search.doc, to_tsquery(:query || ':*')) DESC
    LIMIT :limit;
"""
