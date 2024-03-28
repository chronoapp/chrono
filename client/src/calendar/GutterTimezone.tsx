import React from 'react'
import { DateTime } from 'luxon'
import { formatTimeShort } from '../util/localizer-luxon'
import { Box } from '@chakra-ui/react'
function renderDateLabel(group: DateTime[], idx: number) {
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

export const GutterTimezone = ({ id, gutterRef, slotMetrics }) => {
  return (
    <div key={id} className="cal-time-gutter" ref={gutterRef}>
      {slotMetrics.current.groups.map((group, idx) => {
        return renderDateLabel(group, idx)
      })}
    </div>
  )
}
