TRENDS_QUERY = """
with filtered_events as (
        SELECT
            event.start at time zone :timezone as start,
            event.end at time zone :timezone_end as end,
            label.key as label
        FROM event
        INNER JOIN user_calendar ON event.calendar_id = user_calendar.id
        INNER JOIN event_label ON event_label.event_pk = event.pk
        INNER JOIN label ON label.id = event_label.label_id
        WHERE {labelIdsFilter}
        AND event.status != 'deleted'
        AND event.start >= :start_time
        AND event.end <= :end_time
        AND user_calendar.user_id = :userId
    )
SELECT starting,
    coalesce(sum(EXTRACT(EPOCH FROM (e.end - e.start))), 0),
    count(e.start) AS event_count
FROM generate_series(date_trunc('DAY', CAST(:start_time as date))
                    , :interval_end_time
                    , CAST('{interval}' as interval)) g(starting)
LEFT JOIN filtered_events e
    ON e.start > g.starting
    AND e.start <  g.starting + CAST('{interval}' as interval)
GROUP BY starting
ORDER BY starting;
"""
