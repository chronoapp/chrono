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
    event_participant p
JOIN
    event e ON p.event_uid = e.uid
JOIN
	contact c on c.email = p.email_
WHERE
	c.user_id = :userId
AND
	e.start >= :startDateTime
GROUP BY
    c.id,
    c.email,
    c.first_name,
    c.last_name,
    c.photo_url,
    c.google_id
ORDER BY
    last_seen DESC;
"""
