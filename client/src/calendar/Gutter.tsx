import React from 'react'
import { useDrag } from 'react-dnd'
import { RefObject } from 'react'
import { DateTime } from 'luxon'
import { formatTimeShort } from '../util/localizer-luxon'
import { Box } from '@chakra-ui/react'

interface GutterProps {
  id: number
  content: string
  slotMetrics: {
    current: {
      groups: any[] // Adjust the type based on your actual data structure
    }
  }
  gutterRef: RefObject<HTMLDivElement>
}

const Gutter: React.FC<GutterProps> = ({ id, content, slotMetrics, gutterRef }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'GUTTER',
    item: { id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }))

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
    <div ref={drag} key={id} className="cal-time-gutter" style={{ opacity: isDragging ? 0.5 : 1 }}>
      {slotMetrics.current.groups.map((group, idx) => {
        return renderDateLabel(group, idx)
      })}
    </div>
  )
}

export default Gutter
