import React, { forwardRef } from 'react'
import { Box } from '@chakra-ui/react'
import TimezoneLabel from './TimezoneLabel'
import { formatTimeShort } from '../util/localizer-luxon'

interface GutterContentProps {
  slotMetrics: any
}

const GutterContent = forwardRef<HTMLDivElement, GutterContentProps>(({ slotMetrics }, ref) => (
  <div ref={ref} className="cal-time-gutter">
    <TimezoneLabel />
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
