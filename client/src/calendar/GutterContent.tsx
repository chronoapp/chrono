import React, { forwardRef } from 'react'
import { Box } from '@chakra-ui/react'
import { formatTimeShort } from '@/util/localizer-joda'
import { ZoneId, ZonedDateTime } from '@js-joda/core'

/**
 * Renders the time that reflects the timezone in the gutter
 */
interface GutterContentProps {
  slotMetrics: any
  timezone: { id: number; timezoneId: string }
}

const GutterContent = forwardRef<HTMLDivElement, GutterContentProps>(
  ({ slotMetrics, timezone }, ref) => (
    <div ref={ref} className="cal-time-gutter">
      {slotMetrics.current.groups.map((group, idx) => renderDateLabel(group, idx, timezone))}
    </div>
  )
)

function renderDateLabel(group, idx, timezone) {
  // Ensure the date uses the passed timezone
  const zonedDate = group[0].withZoneSameInstant(ZoneId.of(timezone.timezoneId))
  const timeRange = formatTimeShort(zonedDate, true).toUpperCase()

  return (
    <div className="cal-time-gutter-box" key={idx}>
      {idx === 0 ? null : (
        <Box className="cal-time-gutter-label" color="grey">
          {timeRange}
        </Box>
      )}
    </div>
  )
}

export default GutterContent
