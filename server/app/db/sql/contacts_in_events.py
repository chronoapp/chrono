CONTACT_IN_EVENTS_QUERY = """
SELECT
    SUM(EXTRACT(EPOCH FROM (e.end - e.start))) AS total_time_spent_in_seconds,
    MAX(e.end) AS last_seen,
    c.id,
    c.email,
    c.first_name,
    c.last_name,
    c.photo_url,
    c.google_id
FROM
    contact c
LEFT JOIN
    event_participant p ON c.email = p.email_
LEFT JOIN
    event e ON p.event_uid = e.uid AND e.start >= :startDateTime AND e.end <= :endDateTime
LEFT JOIN
    user_credentials uc ON c.account_id = uc.id
WHERE
    uc.user_id = :userId
GROUP BY
    c.id,
    c.email,
    c.first_name,
    c.last_name,
    c.photo_url,
    c.google_id
ORDER BY
    (MAX(e.end) IS NULL) ASC, MAX(e.end) DESC
LIMIT :limit;
"""
