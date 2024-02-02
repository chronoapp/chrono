CONTACT_SEARCH_QUERY = """
    SELECT id FROM (
        SELECT contact.*,
            setweight(to_tsvector('english', coalesce(contact.first_name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(contact.last_name, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(contact.email, '')), 'C') as doc
        FROM contact
        JOIN user_credentials ON user_credentials.id = contact.account_id
        WHERE user_credentials.user_id = :userId
    ) search
    WHERE search.doc @@ to_tsquery(:query || ':*') AND email IS NOT NULL
    ORDER BY ts_rank(search.doc, to_tsquery(:query || ':*')) DESC
    LIMIT :limit;
"""
