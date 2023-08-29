import React from 'react'
import { useToast, Box } from '@chakra-ui/react'
import clsx from 'clsx'

import { useRecoilValue } from 'recoil'
import { calendarWithDefault } from '@/state/CalendarState'
import {
  dragDropActionState,
  editingEventState,
  Direction,
  multiSelectEventState,
} from '@/state/EventsState'
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
  const multiSelectedEvents = useRecoilValue(multiSelectEventState)
  const dragAndDropAction = useRecoilValue(dragDropActionState)
  const toast = useToast()

  // Tiny gap to separate events.
  const eventHeight = props.style.height - 0.15

  const event = props.event
  const calendar = useRecoilValue(calendarWithDefault(event.calendar_id))
  const responseStatus = Event.getResponseStatus(event, calendar)
  const canEditEvent = calendar.canEditEvent(props.event)

  // Local Drag & Drop state.
  const dragStart = React.useRef({ x: 0, y: 0 })
  const currentEvent = React.useRef<Element>(undefined!)
  const otherDraggedEvents = React.useRef<Element[]>([])

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

  function handleClickEvent(e: React.MouseEvent) {
    // Stop the dragging event.
    eventActions.onInteractionEnd()

    if (e.shiftKey && canEditEvent) {
      eventActions.onMultiSelectEvent(props.event)
    } else {
      const isSelected =
        props.event.id === editingEvent?.id &&
        props.event.calendar_id === editingEvent?.event.calendar_id

      const changedSelection = editingEvent?.selectTailSegment !== props.isTailSegment

      console.log('isSelected', isSelected)
      console.log('changedSelection', changedSelection)

      if (!isSelected || changedSelection) {
        console.log('initEditEvent')
        eventActions.initEditEvent(props.event, props.isTailSegment)
      }
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

    const startOfDay = props.isTailSegment
      ? dates.startOf(event.end, 'day')
      : dates.startOf(event.start, 'day')

    const minutes = ((dates.MILLI.day / dates.MILLI.minutes) * offsetTop) / totalHeight
    const dateOfDrag = dates.add(startOfDay, minutes, 'minutes')

    return dateOfDrag
  }

  function onDragStart(evt: React.DragEvent) {
    console.log('onDragStart')

    if (canEditEvent) {
      // Create an image and use it for the drag image
      // var img = document.createElement('img')
      // img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
      // document.body.appendChild(img)
      // evt.dataTransfer.setDragImage(img, 0, 0)

      const selectedItemsQuery = Object.values(multiSelectedEvents)
        .map((e) => `.cal-event-${e.id}`)
        .join(',')

      const thisEvent = document.querySelector(`.cal-event-${event.id}`)
      dragStart.current = { x: evt.pageX, y: evt.pageY }
      console.log('thisEvent', thisEvent, dragStart.current)

      if (thisEvent) {
        currentEvent.current = thisEvent
        otherDraggedEvents.current = [thisEvent as HTMLElement]

        if (selectedItemsQuery) {
          const selectedEvents = document.querySelectorAll(selectedItemsQuery)
          otherDraggedEvents.current = Array.from(selectedEvents)
          otherDraggedEvents.current.map((item) => {
            if (item instanceof HTMLElement) {
              item.style.opacity = '0'
            }
          })
        }

        const dateOfClick = getDateOfClick(evt)
        eventActions.onBeginAction(props.event, 'MOVE', dateOfClick)
      }
    } else {
      evt.preventDefault()
      toast({
        render: (props) => (
          <ToastTag
            title={'Cannot rechedule event.'}
            showSpinner={false}
            Icon={props.icon}
            onClose={props.onClose}
          />
        ),
        position: 'bottom',
      })
    }
  }

  function onDrag(evt: React.DragEvent) {
    // const movex = evt.pageX - dragStart.current.x
    // const movey = evt.pageY - dragStart.current.y
    // const element = currentEvent.current as HTMLElement
    // element.style.transform = `translate(${movex}px, ${movey}px)`
    // element.style.opacity = '0.5'
    // otherDraggedEvents.current.map((item) => {
    //   if (item instanceof HTMLElement) {
    //     item.style.transform = `translate(${movex}px, ${movey}px)`
    //     item.style.opacity = '0.5'
    //   }
    // })
  }

  function onDragEnd(evt: React.DragEvent) {
    const element = currentEvent.current as HTMLElement
    element.style.transform = 'none'
    element.style.opacity = '1'
    otherDraggedEvents.current.map((item) => {
      if (item instanceof HTMLElement) {
        item.style.transform = 'none'
        item.style.opacity = '1'
      }
    })
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

  const isInteracting =
    dragAndDropAction &&
    dragAndDropAction.interacting &&
    dragAndDropAction.event.id === event.id &&
    !props.isPreview

  const isEditing = editingEvent?.id === event.id
  const backgroundColor = Event.getBackgroundColor(event.end, calendar.backgroundColor, props.now)

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
    : Event.getForegroundColor(event.end, props.now, event.foregroundColor)

  const textDecoration = responseStatus === 'declined' ? 'line-through' : undefined

  const isMultiSelected = multiSelectedEvents.hasOwnProperty(event.id)

  return (
    <Box
      ref={props.innerRef}
      willChange={'transform, opacity'}
      className={clsx(
        'cal-event',
        `cal-event-${event.id}`,
        isMultiSelected && 'cal-event-selected',
        responseStatus === 'tentative' && 'tentative',
        isInteracting && 'cal-dnd-interacting',
        (isEditing || props.isPreview) && 'cal-has-shadow'
      )}
      top={stringifyPercent(props.style.top)}
      left={stringifyPercent(props.style.xOffset)}
      width={stringifyPercent(props.style.width)}
      height={stringifyPercent(eventHeight)}
      zIndex={isEditing ? 5 : 0}
      cursor={props.isPreview ? 'move' : 'pointer'}
      padding={'unset'}
      backgroundColor={backgroundColorComputed}
      border={border}
      color={color}
      textDecoration={textDecoration}
      draggable={true}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    >
      {eventContents}
      {canEditEvent &&
        renderAnchor('DOWN', dragAndDropAction?.action == 'RESIZE' && props.isPreview)}
    </Box>
  )
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <TimeGridEvent innerRef={ref} {...props} />
))
