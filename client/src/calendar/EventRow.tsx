import React from 'react'
import { useRecoilValue } from 'recoil'
import clsx from 'clsx'
import { Portal, Popover, PopoverTrigger, PopoverContent, PopoverArrow } from '@chakra-ui/react'

import { calendarWithDefault } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { dragDropActionState, editingEventState } from '@/state/EventsState'

import { EventSegment } from './utils/eventLevels'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { timeFormatShort } from '../util/localizer'
import EventPopover from './event-edit/EventEditPopover'

import Event from '../models/Event'
import { EventService } from './event-edit/useEventService'

export function EventItem(props: {
  event: Event
  isPreview: boolean
  now: Date
  eventService: EventService
}) {
  const { event } = props
  const calendar = useRecoilValue(calendarWithDefault(event.calendar_id))
  const eventActions = useEventActions()
  const editingEvent = useRecoilValue(editingEventState)
  const dndAction = useRecoilValue(dragDropActionState)

  const eventTitle = Event.getDefaultTitle(event.title_short)

  function handleStartDragging(e) {
    if (e.button === 0 && calendar?.isWritable()) {
      eventActions.onBeginAction(event, 'MOVE', null)
    }
  }

  function handleClickEvent(e) {
    if (props.event.id !== editingEvent?.id) {
      eventActions.initEditEvent(event)
    }
  }

  let eventDisplay
  if (event.all_day) {
    eventDisplay = (
      <div
        className={clsx('cal-event', props.isPreview && 'cal-event-preview-full')}
        style={{
          backgroundColor: Event.getBackgroundColor(event.end, calendar.backgroundColor, props.now),
          color: Event.getForegroundColor(
            event.end,
            props.now,
            event.foregroundColor,
            calendar.backgroundColor
          ),
        }}
        onMouseDown={handleStartDragging}
        onTouchStart={handleStartDragging}
        onClick={handleClickEvent}
      >
        <div className="cal-event-content" style={{ whiteSpace: 'inherit', height: '1.5em' }}>
          {eventTitle}
        </div>
      </div>
    )
  } else {
    eventDisplay = (
      <div
        className={clsx('cal-event-row', props.isPreview && 'cal-event-preview')}
        style={{
          alignItems: 'center',
          color: Event.getForegroundColor(
            event.end,
            props.now,
            event.foregroundColor,
            calendar.backgroundColor
          ),
        }}
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

  const isDragging = dndAction && dndAction.interacting && dndAction.event.id === event.id
  const isEditing =
    editingEvent?.id === event.id &&
    editingEvent?.event?.calendar_id === event.calendar_id &&
    (editingEvent?.editMode === 'READ' || editingEvent?.editMode === 'EDIT')

  if (isEditing && !isDragging) {
    return (
      <Popover isOpen={true}>
        <PopoverTrigger>{eventDisplay}</PopoverTrigger>
        <Portal>
          <PopoverContent>
            <PopoverArrow />
            <EventPopover event={event} eventService={props.eventService} />
          </PopoverContent>
        </Portal>
      </Popover>
    )
  } else {
    return eventDisplay
  }
}

interface IProps {
  segments: EventSegment[]
  slotMetrics: DateSlotMetrics
  className?: string
  isPreview: boolean
  eventService: EventService
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

        const content = (
          <EventItem
            isPreview={props.isPreview}
            event={segment.event}
            now={now}
            eventService={props.eventService}
          />
        )
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
