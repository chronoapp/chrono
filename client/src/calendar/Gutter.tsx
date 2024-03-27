import React from 'react'
import { DateTime } from 'luxon'
import { formatTimeShort } from '../util/localizer-luxon'
import { Box } from '@chakra-ui/react'

interface GutterProps {
  id: number
  slotMetrics: {
    current: {
      groups: any[]
    }
  }
}

const Gutter: React.FC<GutterProps> = ({ id, slotMetrics }) => {
  function renderDateLabel(group: DateTime[], idx: number) {
    const timeRange = formatTimeShort(group[0], true).toUpperCase()

    return (
      <div className="cal-time-gutter-box" key={idx}>
        {idx === 0 ? null : (
          <Box className="cal-time-gutter-label" color="gray.600">
            {timeRange}
          </Box>
        )}
      </div>
    )
  }

  return (
    <div key={id} className="cal-time-gutter">
      {slotMetrics.current.groups.map((group, idx) => {
        return renderDateLabel(group, idx)
      })}
    </div>
  )
}

export default Gutter
