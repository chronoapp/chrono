import React, { useContext } from 'react'
import * as dates from '../util/dates'

import clsx from 'clsx'
import Event from '../models/Event'
import { timeFormatShort } from '../util/localizer'

import { Direction, EventActionContext } from './EventActionContext'
import { CalendarsContext } from '@/contexts/CalendarsContext'
import { LabelTagColor } from '../components/LabelTag'

interface IProps {
  event: Event
  style: { top: number; width: number; height: number; xOffset: number; border: string }
  label: string
  isPreview: boolean
  now: Date
  isTailSegment?: boolean
  innerRef?: React.Ref<HTMLDivElement>
  getContainerRef: () => React.RefObject<HTMLDivElement>
}

function stringifyPercent(v: number | string) {
  return typeof v === 'string' ? v : v + '%'
}

function TimeGridEvent(props: IProps) {
  const eventActionContext = useContext(EventActionContext)
  const calendarsContext = useContext(CalendarsContext)
  // Tiny gap to separate events.
  const eventHeight = props.style.height - 0.15
  const ref = React.useRef<HTMLDivElement>(null)

  const event = props.event
  const calendar = calendarsContext.getDefaultCalendar(event.calendar_id)

  function handleResize(e, direction: Direction) {
    if (e.button === 0 && calendar.isWritable()) {
      e.stopPropagation()
      eventActionContext?.onBeginAction(props.event, 'RESIZE', null, direction)
    }
  }

  function handleStartDragging(e) {
    if (e.button === 0 && calendar.isWritable()) {
      eventActionContext?.onBeginAction(props.event, 'MOVE', null)
    }
  }

  function handleClickEvent(e) {
    const curEventNotSelected = props.event.id !== eventActionContext.eventState.editingEvent?.id
    const changedSelection =
      eventActionContext.eventState.editingEvent?.selectTailSegment !== props.isTailSegment

    // Stop the dragging event.
    eventActionContext?.onInteractionEnd()

    if (curEventNotSelected || changedSelection) {
      eventActionContext?.eventDispatch({
        type: 'INIT_EDIT_EVENT',
        payload: { event: props.event, selectTailSegment: props.isTailSegment },
      })
    }
  }

  /**
   * Fix the number of lines that the event title can display.
   */
  function getEventTitleHeight() {
    const LINE_HEIGHT = 15
    let titleMaxHeight = LINE_HEIGHT

    if (props.getContainerRef) {
      const containerRef = props.getContainerRef()
      const { current } = containerRef

      if (current) {
        const height = current.getBoundingClientRect().height
        const totalHeight = (height * eventHeight) / 100 - 3 - 8 // top padding, bottom anchor
        const titleLines = Math.floor(totalHeight / LINE_HEIGHT) - 1 // 1 for the date
        if (titleLines >= 1) {
          titleMaxHeight = titleLines * LINE_HEIGHT
        }
      }
    }

    return titleMaxHeight + 2
  }

  function renderAnchor(direction: Direction, resizing: boolean) {
    return (
      <div
        className={`cal-dnd-resize-ns-anchor`}
        style={resizing ? { maxHeight: '20px', bottom: '-10px' } : {}}
        onMouseDown={(e) => handleResize(e, direction)}
      ></div>
    )
  }

  /**
   * Gets the duration of the event in minutes, accounting for the cut-off at
   * the end of the day.
   */
  function getEventDurationMinutes(): number {
    if (props.isTailSegment || props.style.top == 0) {
      const startOfDay: Date = dates.startOf(event.end, 'day')
      return (event.end.getTime() - startOfDay.getTime()) / 60000
    } else {
      const displayEnd: Date = dates.min(event.end, dates.endOf(event.start, 'day'))
      return (displayEnd.getTime() - event.start.getTime()) / 60000
    }
  }

  /**
   * Gets the Date for where the drag event started.
   */
  function getDateOfClick(evt: React.DragEvent) {
    const containerRef = props.getContainerRef()
    const { current } = containerRef

    const wrapper = current?.closest('.cal-time-content') as HTMLElement
    const offsetTop = evt.clientY - wrapper.offsetTop + wrapper.scrollTop
    const totalHeight = wrapper.scrollHeight

    const startOfDay: Date = dates.startOf(event.end, 'day')
    const minutes = ((dates.MILLI.day / dates.MILLI.minutes) * offsetTop) / totalHeight
    const dateOfDrag = dates.add(startOfDay, minutes, 'minutes')

    return dateOfDrag
  }

  const diffMin = getEventDurationMinutes()
  const displayTitle = Event.getDefaultTitle(event.title_short)

  const tagColors = event.labels.map((label, idx) => (
    <LabelTagColor
      key={label.id}
      style={{ marginLeft: 1, height: 8, width: 8, borderRadius: 3 }}
      colorHex={label.color_hex}
      lighten={event.end < props.now}
      title={label.title}
    />
  ))

  let inner
  if (diffMin <= 30) {
    inner = (
      <div
        className={clsx('cal-event-content', diffMin <= 15 && 'cal-small-event', 'cal-ellipsis')}
        style={{ display: 'flex', lineHeight: '12px' }}
      >
        <span>{displayTitle}</span>
        <span style={{ fontSize: '90%', flex: 1 }}>{`, ${timeFormatShort(event.start)}`}</span>
        <span style={{ display: 'flex', alignItems: 'center' }}>{tagColors}</span>
      </div>
    )
  } else {
    const height = getEventTitleHeight()
    inner = [
      <div key="1" className="cal-event-content" style={{ paddingTop: '3px', maxHeight: height }}>
        {displayTitle}
      </div>,
      <div key="2" className="cal-event-label">
        {props.label}
      </div>,
      <div key="3" style={{ display: 'flex', position: 'absolute', right: 2, bottom: 5 }}>
        {tagColors}
      </div>,
    ]
  }

  const dnd = eventActionContext?.dragAndDropAction
  const isInteracting = dnd && dnd.interacting && dnd.event.id === event.id && !props.isPreview

  const isEditing = eventActionContext?.eventState.editingEvent?.id === event.id
  const calendarColor = calendarsContext.getCalendarColor(event.calendar_id)

  return (
    <div
      ref={props.innerRef}
      className={clsx(
        'cal-event',
        isInteracting && 'cal-dnd-interacting',
        (isEditing || props.isPreview) && 'cal-has-shadow'
      )}
      style={{
        backgroundColor: Event.getBackgroundColor(event, calendarColor, props.now),
        top: stringifyPercent(props.style.top),
        left: stringifyPercent(props.style.xOffset),
        width: stringifyPercent(props.style.width),
        height: stringifyPercent(eventHeight),
        border: props.style.border,
        color: Event.getForegroundColor(event, props.now),
        zIndex: isEditing ? 5 : 0,
        cursor: props.isPreview ? 'move' : 'pointer',
      }}
      onMouseDown={handleStartDragging}
      onTouchStart={handleStartDragging}
      draggable={true}
      onDragStart={(evt: React.DragEvent) => {
        evt.dataTransfer.setData('text', event.id)
        const dateOfClick = getDateOfClick(evt)
        eventActionContext?.onBeginAction(props.event, 'MOVE', dateOfClick)
      }}
      onClick={handleClickEvent}
    >
      {inner}
      {renderAnchor('DOWN', dnd?.action == 'RESIZE' && props.isPreview)}
    </div>
  )
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <TimeGridEvent innerRef={ref} {...props} />
))
