import React, { useContext } from 'react'
import clsx from 'clsx'
import * as dates from '../util/dates'

import { EventSegment } from './utils/eventLevels'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { timeFormatShort } from '../util/localizer'

import Event from '../models/Event'
import { CalendarsContext } from '../components/CalendarsContext'
import { EventActionContext } from './EventActionContext'

function EventItem(props: { event: Event; isPreview: boolean }) {
  const calendarsContext = useContext(CalendarsContext)
  const eventActionContext = useContext(EventActionContext)

  function handleStartDragging(e) {
    if (e.button === 0) {
      eventActionContext?.onBeginAction(event, 'MOVE')
    }
  }
  const { event } = props
  if (event.isAllDay) {
    let color: string = calendarsContext.getCalendarColor(event.calendar_id)

    return (
      <div
        className={clsx('cal-event', props.isPreview && 'cal-event-preview-full')}
        style={{
          backgroundColor: Event.getBackgroundColor(event, color),
          color: Event.getForegroundColor(event),
        }}
        onMouseDown={handleStartDragging}
        onTouchStart={handleStartDragging}
      >
        <div className="cal-event-content">{event.title}</div>
      </div>
    )
  } else {
    return (
      <div
        className={clsx('cal-event-row', props.isPreview && 'cal-event-preview')}
        style={{ alignItems: 'center' }}
        onMouseDown={handleStartDragging}
        onTouchStart={handleStartDragging}
      >
        <div className="cal-label-circle" />
        {timeFormatShort(event.start)}
        <div className="cal-event-content" style={{ width: 0 }}>
          {event.title}
        </div>
      </div>
    )
  }
}

interface IProps {
  segments: EventSegment[]
  slotMetrics: DateSlotMetrics
  className?: string
  isPreview: boolean
}

/**
 * An event row which can span multiple days.
 */
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

  let lastEnd = 1
  const numSlots = props.slotMetrics.range.length

  return (
    <div className={clsx(props.className, 'cal-row')}>
      {props.segments.reduce((row: React.ReactElement[], segment, idx) => {
        const key = '_lvl_' + idx
        const gap = segment.left - lastEnd

        const content = <EventItem isPreview={props.isPreview} event={segment.event} />
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
