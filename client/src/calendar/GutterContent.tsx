import React, { forwardRef } from 'react'
import { Box } from '@chakra-ui/react'
import { LocalTime, DateTimeFormatter } from '@js-joda/core'
import { Locale } from '@js-joda/locale_en-us'

import '@js-joda/locale_en-us'

function formatTimeShort(time, includeMeridiem = false) {
  const pattern = includeMeridiem ? 'h a' : 'HH'
  const formatter = DateTimeFormatter.ofPattern(pattern).withLocale(Locale.US)
  return time.format(formatter)
}

interface GutterContentProps {
  slotMetrics: any
}

const GutterContent = forwardRef<HTMLDivElement, GutterContentProps>(({ slotMetrics }, ref) => (
  <div ref={ref} className="cal-time-gutter">
    {slotMetrics.current.groups.map((group, idx) => renderDateLabel(group, idx))}
  </div>
))

function renderDateLabel(group, idx) {
  const timeRange = formatTimeShort(group[0], true).toUpperCase()

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
