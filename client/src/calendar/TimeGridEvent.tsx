import React, { useContext } from 'react'

import clsx from 'clsx'
import Event from '../models/Event'
import { timeFormatShort } from '../util/localizer'

import { Direction, EventActionContext } from './EventActionContext'
import { CalendarsContext } from '../components/CalendarsContext'

interface IProps {
  event: Event
  style: { top: number; width: number; height: number; xOffset: number; border: string }
  label: string
  isPreview: boolean
  innerRef?: React.Ref<HTMLDivElement>
  now: Date
}

function stringifyPercent(v: number | string) {
  return typeof v === 'string' ? v : v + '%'
}

function TimeGridEvent(props: IProps) {
  const eventActionContext = useContext(EventActionContext)
  const calendarsContext = useContext(CalendarsContext)

  function foregroundColor() {
    return event.end < props.now ? 'hsl(0, 0%, 45%)' : event.foregroundColor
  }

  function handleResize(e, direction: Direction) {
    if (e.button !== 0) {
      return
    }
    e.stopPropagation()
    eventActionContext?.onBeginAction(props.event, 'RESIZE', direction)
  }

  function handleStartDragging(e) {
    if (e.button === 0) {
      eventActionContext?.onBeginAction(props.event, 'MOVE')
    }
  }

  function handleClickEvent(e) {
    if (props.event.id !== eventActionContext.eventState.editingEventId) {
      eventActionContext?.eventDispatch({ type: 'INIT_EDIT_EVENT', payload: props.event })
    }
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

  const { event } = props

  const diffMin = (event.end.getTime() - event.start.getTime()) / 60000
  const displayTitle = event.title ? event.title : '(No title)'

  let inner
  if (diffMin <= 30) {
    inner = (
      <div
        className={clsx('cal-event-content', diffMin <= 15 && 'cal-small-event')}
        style={{ display: 'flex' }}
      >
        <span>{displayTitle}</span>
        <span className="cal-ellipsis" style={{ fontSize: '90%', flex: 1 }}>
          {`, ${timeFormatShort(event.start)}`}
        </span>
      </div>
    )
  } else {
    inner = [
      <div key="1" className="cal-event-content" style={{ paddingTop: '3px' }}>
        {displayTitle}
      </div>,
      <div key="2" className="cal-event-label">
        {props.label}
      </div>,
    ]
  }

  const dnd = eventActionContext?.dragAndDropAction
  const isInteracting =
    dnd && dnd.interacting && dnd.event.id === props.event.id && !props.isPreview

  // Tiny gap to separate events.
  const finalHeight = props.style.height - 0.15
  const isEditing = eventActionContext?.eventState.editingEventId === event.id

  const calendarColor = calendarsContext.getCalendarColor(event.calendar_id)

  return (
    <div
      ref={props.innerRef}
      className={clsx(
        'cal-event',
        isInteracting && 'cal-dnd-interacting',
        (isEditing || props.isPreview) && 'cal-has-shadow',
        props.isPreview && 'is-dragging'
      )}
      style={{
        backgroundColor: Event.getBackgroundColor(props.event, calendarColor),
        top: stringifyPercent(props.style.top),
        left: stringifyPercent(props.style.xOffset),
        width: stringifyPercent(props.style.width),
        height: stringifyPercent(finalHeight),
        border: props.style.border,
        color: Event.getForegroundColor(props.event),
      }}
      onMouseDown={handleStartDragging}
      onTouchStart={handleStartDragging}
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
