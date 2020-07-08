import React from 'react'
import clsx from 'clsx'

import * as dates from '../util/dates'
import Event from '../models/Event'
import { EventSegment } from './utils/eventLevels'
import DateSlotMetrics from './utils/DateSlotMetrics'

interface IProps {
  segments: EventSegment[]
  slotMetrics: DateSlotMetrics
}

export default function EventRow(props: IProps) {
  function renderSpan(slots: number, len: number, key: string, content?: React.ReactElement) {
    const flexBasis = (Math.abs(len) / slots) * 100 + '%'
    return (
      <div style={{ flexBasis: flexBasis }} className="cal-row-segment" key={key}>
        {content}
      </div>
    )
  }

  function renderEvent(event: Event) {
    const content = <div className="cal-event-content">{event.title}</div>

    return <div className="cal-event">{content}</div>
  }

  let lastEnd = 1
  const numSlots = props.slotMetrics.range.length

  return (
    <div className="cal-row">
      {props.segments.reduce((row, segment, idx) => {
        const key = '_lvl_' + idx
        const gap = segment.left - lastEnd

        const content = renderEvent(segment.event)
        if (gap) {
          row.push(renderSpan(numSlots, gap, `gap_${key}`, null))
        }
        row.push(renderSpan(numSlots, segment.span, key, content))

        lastEnd = segment.right + 1

        return row
      }, [])}
    </div>
  )
}
