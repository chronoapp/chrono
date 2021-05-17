import React from 'react'
import clsx from 'clsx'
import { Portal, Popover, PopoverTrigger, PopoverContent, PopoverArrow } from '@chakra-ui/react'

import { EventSegment } from './utils/eventLevels'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { timeFormatShort } from '../util/localizer'
import EventPopover from './event-edit/EventPopover'

import Event from '../models/Event'
import { CalendarsContext } from '@/contexts/CalendarsContext'
import { EventActionContext } from './EventActionContext'

export function EventItem(props: { event: Event; isPreview: boolean; now: Date }) {
  const calendarsContext = React.useContext(CalendarsContext)
  const eventActionContext = React.useContext(EventActionContext)
  const { event } = props
  const calendar = calendarsContext.getDefaultCalendar(event.calendar_id)
  const eventTitle = Event.getDefaultTitle(event)

  function handleStartDragging(e) {
    if (e.button === 0 && calendar.isWritable()) {
      eventActionContext.onBeginAction(event, 'MOVE')
    }
  }

  function handleClickEvent(e) {
    if (props.event.id !== eventActionContext.eventState.editingEvent?.id) {
      eventActionContext.eventDispatch({ type: 'INIT_EDIT_EVENT', payload: { event: event } })
    }
  }

  let eventDisplay
  if (event.all_day) {
    let color: string = calendarsContext.getCalendarColor(event.calendar_id)
    eventDisplay = (
      <div
        className={clsx('cal-event', props.isPreview && 'cal-event-preview-full')}
        style={{
          backgroundColor: Event.getBackgroundColor(event, color, props.now),
          color: Event.getForegroundColor(event, props.now),
        }}
        onMouseDown={handleStartDragging}
        onTouchStart={handleStartDragging}
        onClick={handleClickEvent}
      >
        <div className="cal-event-content">{eventTitle}</div>
      </div>
    )
  } else {
    eventDisplay = (
      <div
        className={clsx('cal-event-row', props.isPreview && 'cal-event-preview')}
        style={{ alignItems: 'center', color: Event.getForegroundColor(event, props.now) }}
        onMouseDown={handleStartDragging}
        onTouchStart={handleStartDragging}
        onClick={handleClickEvent}
      >
        <div className="cal-label-circle" />
        {timeFormatShort(event.start)}
        <div className="cal-event-content" style={{ width: 0 }}>
          {eventTitle}
        </div>
      </div>
    )
  }

  const dnd = eventActionContext.dragAndDropAction
  const isDragging = dnd && dnd.interacting && dnd.event.id === event.id
  const isEditing = eventActionContext.eventState.editingEvent?.id === event.id

  if (isEditing && !isDragging) {
    return (
      <Popover isOpen={true} isLazy={true}>
        <PopoverTrigger>{eventDisplay}</PopoverTrigger>
        <Portal>
          <PopoverContent w="25em">
            <PopoverArrow />
            <EventPopover event={event} />
          </PopoverContent>
        </Portal>
      </Popover>
    )
  }

  return eventDisplay
}

interface IProps {
  segments: EventSegment[]
  slotMetrics: DateSlotMetrics
  className?: string
  isPreview: boolean
}

export function renderSpan(slots: number, len: number, key: string, content?: React.ReactElement) {
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

/**
 * An event row which can span multiple days.
 */
export default function EventRow(props: IProps) {
  let lastEnd = 1
  const numSlots = props.slotMetrics.range.length
  const now = new Date()

  return (
    <div className={clsx(props.className, 'cal-row')}>
      {props.segments.reduce((row: React.ReactElement[], segment, idx) => {
        const key = '_lvl_' + idx
        const gap = segment.left - lastEnd

        const content = <EventItem isPreview={props.isPreview} event={segment.event} now={now} />
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
