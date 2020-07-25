import React, { useContext } from 'react'

import clsx from 'clsx'
import Event from '../models/Event'
import { timeFormatShort } from '../util/localizer'

import { Direction, EventActionContext } from './EventActionContext'

interface IProps {
  event: Event
  style: { top: number; width: number; height: number; xOffset: number; border: string }
  label: string
  isPreview: boolean
  innerRef?: React.Ref<HTMLDivElement>
}

function stringifyPercent(v: number | string) {
  return typeof v === 'string' ? v : v + '%'
}

function TimeGridEvent(props: IProps) {
  const eventActionContext = useContext(EventActionContext)

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
    if (!props.event.creating) {
      eventActionContext?.eventDispatch({ type: 'INIT_EDIT_EVENT', payload: props.event })
    }
  }

  function renderAnchor(direction: Direction) {
    return (
      <div
        className={`cal-dnd-resize-ns-anchor`}
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

  return (
    <div
      ref={props.innerRef}
      className={clsx({
        'cal-event': true,
        'cal-dnd-interacting': isInteracting,
        'cal-editing': event.creating,
      })}
      style={{
        backgroundColor: event.backgroundColor,
        top: stringifyPercent(props.style.top),
        left: stringifyPercent(props.style.xOffset),
        width: stringifyPercent(props.style.width),
        height: stringifyPercent(finalHeight),
        border: props.style.border,
        color: event.foregroundColor,
      }}
      onMouseDown={handleStartDragging}
      onTouchStart={handleStartDragging}
      onClick={handleClickEvent}
    >
      {inner}
      {renderAnchor('DOWN')}
    </div>
  )
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <TimeGridEvent innerRef={ref} {...props} />
))
