import React, { useContext } from 'react'
import clsx from 'clsx'
import * as dates from '../util/dates'

import { EventSegment } from './utils/eventLevels'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { timeFormatShort } from '../util/localizer'

import Event from '../models/Event'
import { CalendarsContext } from '../components/CalendarsContext'

interface IProps {
  segments: EventSegment[]
  slotMetrics: DateSlotMetrics
}

/**
 * An event row which can span multiple days.
 */
export default function EventRow(props: IProps) {
  const calendarsContext = useContext(CalendarsContext)

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
      let color: string = calendarsContext.getCalendarColor(event.calendar_id)

      return (
        <div
          className="cal-event"
          style={{
            backgroundColor: Event.getBackgroundColor(event, color),
            color: Event.getForegroundColor(event),
          }}
        >
          <div className="cal-event-content">{event.title}</div>
        </div>
      )
    } else {
      return (
        <div className="cal-event-row" style={{ alignItems: 'center' }}>
          <div className="cal-label-circle" />
          {timeFormatShort(event.start)}
          <div className="cal-event-content" style={{ width: 0 }}>
            {event.title}
          </div>
        </div>
      )
    }
  }

  let lastEnd = 1
  const numSlots = props.slotMetrics.range.length

  return (
    <div className="cal-row">
      {props.segments.reduce((row: React.ReactElement[], segment, idx) => {
        const key = '_lvl_' + idx
        const gap = segment.left - lastEnd

        const content = renderEvent(segment.event)
        if (gap > 0) {
          row.push(renderSpan(numSlots, gap, `gap_${key}`))
        }
        row.push(renderSpan(numSlots, segment.span, key, content))

        lastEnd = segment.right + 1

        return row
      }, [])}
    </div>
  )
}
