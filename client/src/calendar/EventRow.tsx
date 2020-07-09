import React from 'react'
import clsx from 'clsx'

import * as dates from '../util/dates'
import Event from '../models/Event'
import { EventSegment } from './utils/eventLevels'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { timeFormatShort } from '../util/localizer'

interface IProps {
  segments: EventSegment[]
  slotMetrics: DateSlotMetrics
}

export default function EventRow(props: IProps) {
  function renderSpan(slots: number, len: number, key: string, content?: React.ReactElement) {
    const flexBasis = (Math.abs(len) / slots) * 100 + '%'
    return (
      <div
        style={{ flexBasis: flexBasis, maxWidth: flexBasis }}
        className="cal-row-segment"
        key={key}
      >
        {content}
      </div>
    )
  }

  function renderEvent(event: Event) {
    if (event.isAllDay) {
      return (
        <div className="cal-event">
          <div className="cal-event-content">{event.title}</div>
        </div>
      )
    } else {
      return (
        <div className="cal-event-row" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="cal-label-circle" />
          <div className="cal-label-start-date">{timeFormatShort(event.start)}</div>
          <div className="cal-event-content">{event.title}</div>
        </div>
      )
    }
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
