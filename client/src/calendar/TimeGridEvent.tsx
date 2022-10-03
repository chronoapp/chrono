import React from 'react'
import { useToast } from '@chakra-ui/react'
import clsx from 'clsx'

import { useRecoilValue } from 'recoil'
import { calendarWithDefault } from '@/state/CalendarState'
import { dragDropActionState, editingEventState, Direction } from '@/state/EventsState'
import useEventActions from '@/state/useEventActions'

import { ToastTag } from '@/components/Toast'
import Event from '../models/Event'
import { timeFormatShort } from '../util/localizer'
import * as dates from '../util/dates'

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
  const eventActions = useEventActions()
  const editingEvent = useRecoilValue(editingEventState)
  const dnd = useRecoilValue(dragDropActionState)
  const toast = useToast({ duration: 2000, position: 'bottom' })

  // Tiny gap to separate events.
  const eventHeight = props.style.height - 0.15

  const event = props.event
  const calendar = useRecoilValue(calendarWithDefault(event.calendar_id))
  const responseStatus = Event.getResponseStatus(event, calendar)
  const canEditEvent = calendar.canEditEvent(props.event)

  function handleResize(e, direction: Direction) {
    if (e.button === 0 && canEditEvent) {
      eventActions.onBeginAction(props.event, 'RESIZE', null, direction)
    }
  }

  function handleStartDragging(e) {
    if (e.button === 0 && canEditEvent) {
      eventActions.onBeginAction(props.event, 'MOVE', null)
    }
  }

  function handleClickEvent(e) {
    const isSelected =
      props.event.id === editingEvent?.id &&
      props.event.calendar_id === editingEvent?.event.calendar_id

    const changedSelection = editingEvent?.selectTailSegment !== props.isTailSegment

    // Stop the dragging event.
    eventActions.onInteractionEnd()

    if (!isSelected || changedSelection) {
      eventActions.initEditEvent(props.event, props.isTailSegment)
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
        className={clsx('cal-event-content', diffMin <= 20 && 'cal-small-event', 'cal-ellipsis')}
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

  const isInteracting = dnd && dnd.interacting && dnd.event.id === event.id && !props.isPreview

  const isEditing = editingEvent?.id === event.id
  const backgroundColor = Event.getBackgroundColor(event, calendar.backgroundColor, props.now)

  // This is in a separate section so that the drag mouse down event does not conflict with
  // the resize event.
  const eventContents = (
    <div
      onClick={handleClickEvent}
      onMouseDown={handleStartDragging}
      onTouchStart={handleStartDragging}
      className="cal-event-content-wrapper"
    >
      {inner}
    </div>
  )

  const backgroundColorComputed = ['needsAction', 'declined'].includes(responseStatus)
    ? 'white'
    : backgroundColor

  const border = ['needsAction', 'declined'].includes(responseStatus)
    ? `1px dashed ${backgroundColor}`
    : props.style.border

  const color = ['needsAction', 'declined'].includes(responseStatus)
    ? backgroundColor
    : Event.getForegroundColor(event, props.now)

  const textDecoration = responseStatus === 'declined' ? 'line-through' : undefined

  return (
    <div
      ref={props.innerRef}
      className={clsx(
        'cal-event',
        responseStatus === 'tentative' && 'tentative',
        isInteracting && 'cal-dnd-interacting',
        (isEditing || props.isPreview) && 'cal-has-shadow'
      )}
      style={{
        top: stringifyPercent(props.style.top),
        left: stringifyPercent(props.style.xOffset),
        width: stringifyPercent(props.style.width),
        height: stringifyPercent(eventHeight),
        zIndex: isEditing ? 5 : 0,
        cursor: props.isPreview ? 'move' : 'pointer',
        padding: 'unset',
        backgroundColor: backgroundColorComputed,
        border: border,
        color: color,
        textDecoration: textDecoration,
      }}
      draggable={true}
      onDragStart={(evt: React.DragEvent) => {
        if (canEditEvent) {
          const dateOfClick = getDateOfClick(evt)
          eventActions.onBeginAction(props.event, 'MOVE', dateOfClick)
        } else {
          evt.preventDefault()
          toast({
            render: (props) => (
              <ToastTag title={'Cannot rechedule event.'} showSpinner={false} {...props} />
            ),
          })
        }
      }}
    >
      {eventContents}
      {canEditEvent && renderAnchor('DOWN', dnd?.action == 'RESIZE' && props.isPreview)}
    </div>
  )
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <TimeGridEvent innerRef={ref} {...props} />
))
