import React from 'react'
import { Box } from '@chakra-ui/react'

import { getBoundsForNode } from '@/util/Selection'
import { EventActionContext } from './EventActionContext'
import useEventService from './event-edit/useEventService'
import { UNSAVED_EVENT_ID } from '@/models/Event'

import * as dates from '@/util/dates'

class DropRect {
  constructor(
    readonly top: number,
    readonly left: number,
    readonly width: number,
    readonly height: number,
    readonly date: Date
  ) {}
}

// Round to 15 minutes chunks
const TIME_INTERVAL = 15 * dates.MILLI.minutes
const NUM_INTERVALS = dates.MILLI.day / TIME_INTERVAL
const MINUTES_IN_DAY = dates.MILLI.day / dates.MILLI.minutes

interface IProps {
  children: any
  range: Date[]
  scrollContainerRef: React.RefObject<HTMLInputElement>
}

/**
 * Handles Drag & Drop of events.
 * D&D Starts at TimeGridEvent.
 *
 * TODO: Handle drag & drag across multiple days with preview.
 * TODO: Handle ESC faster
 *
 */
export default function DragDropZone(props: IProps) {
  const containerRef = React.useRef<HTMLInputElement>(null)

  const eventsContext = React.useContext(EventActionContext)
  const [dropRect, setDropRect] = React.useState<DropRect | null>(null)
  const { saveEvent, updateEvent } = useEventService()

  const [isDragging, setIsDragging] = React.useState(false)
  const numColumns = props.range.length

  React.useEffect(() => {
    const container = containerRef.current
    console.log(container?.clientHeight, container?.clientWidth)

    if (container) {
      const bounds = getBoundsForNode(container)
      console.debug('Bounds ', bounds)
    }
  }, [])

  function scrollToEventIfNecessary(mouseTop: number) {
    const scrollWrapper = props.scrollContainerRef.current
    const stepSize = 0.3
    const margin = 20

    if (mouseTop === 0) return

    if (scrollWrapper) {
      if (mouseTop - margin <= scrollWrapper.offsetTop) {
        const top = Math.max(0, scrollWrapper.offsetTop - stepSize * scrollWrapper.scrollHeight)
        scrollWrapper.scrollTo({ top: top, behavior: 'smooth' })
      }

      if (mouseTop + margin >= scrollWrapper.offsetTop + scrollWrapper.clientHeight) {
        const top = Math.min(
          scrollWrapper.scrollHeight,
          scrollWrapper.offsetTop + stepSize * scrollWrapper.scrollHeight
        )
        scrollWrapper.scrollTo({ top: top, behavior: 'smooth' })
      }
    }
  }

  return (
    <div
      className="cal-time-content-zone"
      ref={containerRef}
      onDragEnter={() => {
        if (!isDragging) {
          eventsContext.onInteractionStart()
          setIsDragging(true)
        }
      }}
      onDragOver={(e) => {
        const container = containerRef.current

        if (container) {
          const columnWidth = container.clientWidth / numColumns
          const bounds = getBoundsForNode(container)
          const event = eventsContext.dragAndDropAction!.event
          const dragPointerDate = eventsContext.dragAndDropAction!.pointerDate!

          const totalHeight = container.clientHeight
          const pxPerMin = totalHeight / (dates.MILLI.day / dates.MILLI.minutes)

          // Event column
          const offsetLeft = e.clientX - bounds.left
          const colNum = Math.floor(offsetLeft / columnWidth)

          // Event height
          const eventMins = dates.diff(event.start, event.end, 'minutes')
          const heightPx = eventMins * pxPerMin

          // Offset for the click position within the event.
          const clickOffsetMins = dates.diff(event.start, dragPointerDate, 'minutes')
          const clickOffsetPx = clickOffsetMins * pxPerMin

          const top = e.clientY - bounds.top - clickOffsetPx
          const intervalHeight = totalHeight / NUM_INTERVALS
          const roundedTop = intervalHeight * Math.round(top / intervalHeight)

          // Find out the start and end date of the dragged event
          const rangeStart = dates.startOf(props.range[0])
          const columnStart = dates.add(rangeStart, colNum, 'day')
          const minutesFromTop = (MINUTES_IN_DAY * roundedTop) / totalHeight
          const startDate = dates.add(columnStart, minutesFromTop, 'minutes')

          setDropRect(
            new DropRect(roundedTop, colNum * columnWidth, columnWidth, heightPx, startDate)
          )

          scrollToEventIfNecessary(e.clientY)
        }

        e.preventDefault()
      }}
      onDragLeave={(e) => {
        scrollToEventIfNecessary(e.clientY)
      }}
      onDrop={(e) => {
        const event = eventsContext.dragAndDropAction!.event
        const dropDateStart = dropRect!.date
        const eventMins = dates.diff(event.start, event.end, 'minutes')
        const updatedEvent = {
          ...event,
          start: dropDateStart,
          end: dates.add(dropDateStart, eventMins, 'minutes'),
        }

        if (updatedEvent.id === UNSAVED_EVENT_ID) {
          updateEvent(updatedEvent, true)
        } else {
          saveEvent(updatedEvent, true)
        }
      }}
      onDragEnd={(e) => {
        setDropRect(null)
        setIsDragging(false)
        eventsContext.onInteractionEnd()
      }}
    >
      {dropRect && (
        <Box
          position="absolute"
          left={`${dropRect.left + 1}px`}
          width={`${dropRect.width - 1}px`}
          height={`${dropRect.height}px`}
          top={`${dropRect.top}px`}
          border="3px solid"
          borderColor={'blue.300'}
          borderRadius="sm"
        />
      )}
      {props.children}
    </div>
  )
}
