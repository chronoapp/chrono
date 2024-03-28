import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { formatTimeShort } from '../util/localizer-luxon'
import { Box } from '@chakra-ui/react'
import { DateTime } from 'luxon'
import React, { useRef, useState, useEffect } from 'react'

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

export function SortableGutter({ id, color, index, gutterRef, slotMetrics }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: color }}
      {...attributes}
      {...listeners}
    >
      {slotMetrics.current.groups.map((group, idx) => {
        return renderDateLabel(group, idx)
      })}
    </div>
  )
}
