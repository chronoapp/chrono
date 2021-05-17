import React, { ReactElement } from 'react'
import { Text, Box } from '@chakra-ui/react'

import { eventLevels, EventSegment } from './utils/eventLevels'
import { renderSpan, EventItem } from './EventRow'

interface IProps {
  segments: EventSegment[]
  slots: number
  now: Date
}

let isSegmentInSlot = (seg: EventSegment, slot: number) => seg.left <= slot && seg.right >= slot
let eventsInSlot = (segments: EventSegment[], slot: number) =>
  segments.filter((seg) => isSegmentInSlot(seg, slot)).length

function range(start: number, count: number) {
  return Array.from(Array(count), (_, i) => start + i)
}

export default function EventEndingRow(props: IProps) {
  function canRenderSlotEvent(slot: number, span: number) {
    return range(slot, span).every((s) => {
      let count = eventsInSlot(props.segments, s)

      return count === 1
    })
  }

  function renderShowMore(segments: EventSegment[], slot: number) {
    let count = eventsInSlot(segments, slot)

    return (
      <Text
        color="gray.700"
        fontSize="xs"
        className="cal-event-row"
        onClick={(e) => {
          // TODO: Handle show more.
        }}
      >
        {count} more
      </Text>
    )
  }

  const rowSegments = eventLevels(props.segments).levels[0]
  let current = 1,
    lastEnd = 1
  const row: ReactElement[] = []

  const { slots } = props

  while (current <= slots) {
    let key = '_lvl_' + current

    let { event, left, right, span } =
      rowSegments.filter((seg) => isSegmentInSlot(seg, current))[0] || {} //eslint-disable-line

    if (!event) {
      current++
      continue
    }

    let gap: number = Math.max(0, left - lastEnd)

    if (canRenderSlotEvent(left, span)) {
      let content = <EventItem isPreview={false} event={event} now={props.now} />

      if (gap) {
        row.push(renderSpan(slots, gap, key + '_gap'))
      }

      row.push(renderSpan(slots, span, key, content))

      lastEnd = current = right + 1
    } else {
      if (gap) {
        row.push(renderSpan(slots, gap, key + '_gap'))
      }

      row.push(renderSpan(slots, 1, key, renderShowMore(props.segments, current)))
      lastEnd = current = current + 1
    }
  }

  return <div className="cal-row">{row}</div>
}
