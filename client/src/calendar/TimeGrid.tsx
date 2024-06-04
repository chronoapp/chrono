import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useRecoilValue } from 'recoil'
import getScrollbarSize from 'dom-helpers/scrollbarSize'

import { ZonedDateTime as DateTime, ChronoUnit } from '@js-joda/core'
import * as dates from '@/util/dates-joda'

import Event from '../models/Event'
import DayColumn from './DayColumn'
import TimeGridHeader from './TimeGridHeader'
import DragDropZone from './DragDropZone'
import SlotMetrics from './utils/SlotMetrics'
import { inRange, sortEvents } from './utils/eventLevels'
import { GlobalEvent } from '../util/global'
import { EventService } from '@/calendar/event-edit/useEventService'
import Calendar from '@/models/Calendar'

import { editingEventState } from '@/state/EventsState'
import { dragDropActionState } from '@/state/EventsState'
import { Flex } from '@chakra-ui/react'
import Gutter from './Gutter'
import GutterHeader from './GutterHeader'
import { DndContext, closestCorners } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'

import { userState } from '@/state/UserState'
import * as API from '@/util/Api'
import User from '@/models/User'
interface IProps {
  step: number
  timeslots: number
  range: DateTime[]
  events: Event[]
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
}

const GUTTER_LINE_WIDTH = 0.5
const DRAG_REMOVE_LIMIT = 10

function preventScroll(e) {
  e.preventDefault()
}
function remToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}

function TimeGrid(props: IProps) {
  const [intitalGutterHeaderWidth, setIntitalGutterHeaderWidth] = useState(0)
  const [gutterWidth, setGutterWidth] = useState(0)
  const [scrollbarSize, setScrollbarSize] = useState(0)

  const user = useRecoilValue(userState)
  const [timezones, setTimezones] = useState(() =>
    user
      ? [...user.timezones].map((timezone, index) => ({ id: index + 1, timezoneId: timezone }))
      : []
  )

  const [overlayPosition, setOverlayPosition] = useState({ x: 0, y: 0 })
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 })

  const min = dates.startOf(props.now, ChronoUnit.DAYS)
  const max = dates.endOf(props.now, ChronoUnit.DAYS)

  const slotMetrics = useRef<SlotMetrics>(new SlotMetrics(min, max, props.step, props.timeslots))
  const gutterRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLInputElement>(null)
  const timezonelabelRef = useRef<HTMLInputElement>(null)
  const scrollTopRatio = useRef<number | undefined>(undefined)

  const editingEvent = useRecoilValue(editingEventState)
  const dragAndDropAction = useRecoilValue(dragDropActionState)

  useEffect(() => {
    const scrollbarSize = getScrollbarSize()

    // Adjust gutter width to account for scrollbar.
    if (gutterRef.current) {
      const gutterWidth = gutterRef.current.getBoundingClientRect().width
      const gutterAndScrollbar = remToPixels(GUTTER_LINE_WIDTH) + gutterWidth
      setIntitalGutterHeaderWidth(gutterAndScrollbar)
      setGutterWidth(gutterWidth)
      setScrollbarSize(scrollbarSize)
    }
    // Scroll such that the screen is centered where most events are positioned.
    calculateTopScroll(props.events)
    applyTopScroll()

    document.addEventListener(GlobalEvent.scrollToEvent, scrollToEvent)

    return () => {
      document.removeEventListener(GlobalEvent.scrollToEvent, scrollToEvent)
    }
  }, [])
  /**
   * Disable scrolling when editing an event.
   */
  useEffect(() => {
    if (contentRef.current) {
      const disableScroll = editingEvent !== null && !dragAndDropAction
      if (disableScroll) {
        // Disable scrolling
        contentRef.current.addEventListener('wheel', preventScroll, { passive: false })
      } else {
        // Enable scrolling
        contentRef.current.removeEventListener('wheel', preventScroll)
      }
    }

    // Cleanup function to re-enable scrolling when the component unmounts
    return () => {
      if (contentRef.current) {
        contentRef.current.removeEventListener('wheel', preventScroll)
      }
    }
  }, [editingEvent])
  /**
   * updates the User state with the front-end timezone state.
   * Uses `useCallback` to maintain stable function reference across renders
   */
  const updateUserTimezones = useCallback(
    (newTimezones) => {
      if (user) {
        const updatedUser = {
          ...user,
          timezones: newTimezones,
        }
        console.log(updatedUser)
        API.updateUser(updatedUser)
          .then(() => {
            console.log('User timezones updated successfully')
          })
          .catch((error) => {
            console.error('Failed to update user timezones:', error)
          })
      }
    },
    [user]
  )
  /**
   *  Finds the intial posistion of the mouse when clicking the sortable timezones
   */
  useEffect(() => {
    function handlePointerDown(event) {
      const startPosition = { x: event.clientX, y: event.clientY }
      setInitialPosition(startPosition)
      console.log(startPosition)
    }

    const gutterElement = timezonelabelRef.current

    if (gutterElement) {
      gutterElement.addEventListener('pointerdown', handlePointerDown)
    }
    // Cleanup function to remove the event listeners when the component unmounts
    return () => {
      if (gutterElement) {
        gutterElement.removeEventListener('pointerdown', handlePointerDown)
      }
    }
  }, [])
  useEffect(() => {
    applyTopScroll()
  })
  /**
   *Finds the highest number and adds one in the timezone array for unique id
   */
  const getNextId = () => timezones.reduce((max, timezone) => Math.max(max, timezone.id), 0) + 1
  /**
   * Adds new timezone objects with an id and timezoneId e.g "America/Toronto to the frontend state"
   */
  function addTimezones(timezoneId) {
    const newTimezone = { id: getNextId(), timezoneId: timezoneId }
    setTimezones([...timezones, newTimezone])
  }

  /**
   * Scrolls to time, defaults to now if date in event.detail is unspecified.
   */
  function scrollToEvent(event) {
    const { now } = props
    const scrollToDate = event.detail ? event.detail : now

    const totalMillis = dates.diff(max, min)
    const diffMillis = dates.diff(
      scrollToDate,
      dates.startOf(scrollToDate, ChronoUnit.DAYS),
      ChronoUnit.MILLIS
    )
    const scrollTopRatio = diffMillis / totalMillis

    const content = contentRef.current!
    const padding = content.scrollHeight * 0.2

    const scrollTop = Math.max(0, content.scrollHeight * scrollTopRatio - padding)
    content.scrollTo({ top: scrollTop, behavior: 'smooth' })
  }

  /**
   * Makes sure the content is centered at a reasonable place.
   */
  function calculateTopScroll(events: Event[]) {
    const { now, range } = props
    const totalMillis = dates.diff(max, min)

    if (dates.gte(now, range[0]) && dates.lte(now, range[range.length - 1])) {
      const diffMillis = dates.diff(now, dates.startOf(now, ChronoUnit.DAYS)) / 1.1
      scrollTopRatio.current = diffMillis / totalMillis
    }

    if (!events || !events.length) {
      return
    }

    const sampleSize = Math.min(events.length, 3)
    let avgFromTop = 0
    for (let i = 0; i < sampleSize; i++) {
      const scrollToTime = events[i].start
      const diffMillis = dates.diff(
        scrollToTime,
        dates.startOf(scrollToTime, ChronoUnit.DAYS),
        ChronoUnit.MILLIS
      )
      const scrollTop = diffMillis / totalMillis
      avgFromTop += scrollTop
    }

    scrollTopRatio.current = avgFromTop
  }

  /**
   * Only adjust scroll once so it doesn't jump around.
   */
  function applyTopScroll() {
    if (scrollTopRatio.current) {
      const content = contentRef.current!
      const scrollTop = content.scrollHeight * scrollTopRatio.current
      content.scrollTop = scrollTop
      scrollTopRatio.current = undefined
    }
  }

  function renderDays(range: DateTime[]) {
    return range.map((date, jj) => {
      const startOfDay = dates.merge(date, min)
      const dayEvents = props.events.filter(
        (event) =>
          dates.inRange(date, event.start, event.end, ChronoUnit.DAYS) &&
          !event.all_day &&
          !dates.eq(event.end, startOfDay) // Ignore if event ends exactly on start of this day.
      )

      return (
        <DayColumn
          key={jj}
          events={dayEvents}
          date={date}
          step={props.step}
          timeslots={props.timeslots}
          min={startOfDay}
          max={dates.merge(date, max)}
          isCurrentDay={dates.eq(date, props.now, ChronoUnit.DAYS)}
          now={props.now}
          eventService={props.eventService}
          primaryCalendar={props.primaryCalendar}
        />
      )
    })
  }

  const start = props.range[0]
  const end = props.range[props.range.length - 1]
  const allDayEvents = props.events
    .filter((event) => event.all_day && inRange(event, start, end))
    .sort((a, b) => sortEvents(a, b))

  /**
   * Finds the position of a given timezone ID within the timezone array.
   */
  const getGutterPos = (id) => timezones.findIndex((gutter) => gutter.id === id) // using the id to find its positioning

  const [activeId, setActiveId] = useState(null)
  /**
   *  When clicked it sets active state and set the the contentRef to no scrolling
   */
  function handleDragStart(event) {
    contentRef.current?.classList.add('no-scroll')
    const { active } = event
    setActiveId(active.id)
  }
  /**
   * Track the drag move event to update overlay position.
   */
  function handleDragMove(event) {
    const { delta } = event
    setOverlayPosition(() => {
      const newPosition = {
        x: initialPosition.x + delta.x,
        y: initialPosition.y + delta.y,
      }
      return newPosition
    })
    console.log(overlayPosition)
  }

  /**
   * when posistion over an event it rearranges the timezone array
   */

  function handleDragEnd(event) {
    const { active, over } = event
    const gutterContent = contentRef.current?.querySelector('.cal-gutter')
    const DRAG_REMOVE_LIMIT = 20 // Define your drag remove limit value

    if (gutterContent) {
      const boundary = gutterContent.getBoundingClientRect()
      console.log('Boundary:', boundary)
      console.log('Overlay Position:', overlayPosition)

      // Check if the item is dragged beyond the removal boundary
      if (overlayPosition.x > boundary.right + DRAG_REMOVE_LIMIT) {
        console.log('Removing item:', active.id)
        setTimezones((timezones) => {
          const updatedTimezones = timezones.filter((timezone) => timezone.id !== active.id)
          updateUserTimezones(updatedTimezones.map((tz) => tz.timezoneId))
          return updatedTimezones
        })
        setOverlayPosition({ x: 0, y: 0 }) // Reset overlay position
        contentRef.current?.classList.remove('no-scroll')
        return // Exit the function early to avoid unnecessary reordering logic
      }
    }

    // Proceed with reordering only if not removed
    if (over && active.id !== over.id) {
      setTimezones((timezones) => {
        const originalPos = getGutterPos(active.id)
        const newPos = getGutterPos(over.id)
        console.log('Reordering from:', originalPos, 'to:', newPos)

        if (newPos !== -1) {
          const updatedTimezones = arrayMove(timezones, originalPos, newPos)
          updateUserTimezones(updatedTimezones.map((tz) => tz.timezoneId))
          return updatedTimezones
        }
        return timezones
      })
    }

    setOverlayPosition({ x: 0, y: 0 }) // Reset overlay position
    contentRef.current?.classList.remove('no-scroll')
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
    >
      <Flex className="cal-time-view" direction="column">
        <Flex>
          <GutterHeader
            addTimezones={addTimezones}
            timezones={timezones}
            width={intitalGutterHeaderWidth + (timezones.length - 1) * gutterWidth}
            gutterWidth={gutterWidth}
            timezonelabelRef={timezonelabelRef}
          />
          <TimeGridHeader
            events={allDayEvents}
            range={props.range}
            marginRight={scrollbarSize}
            eventService={props.eventService}
            now={props.now}
          />
        </Flex>
        <div ref={contentRef} className="cal-time-content">
          <Gutter
            slotMetrics={slotMetrics}
            timezones={timezones}
            gutterRef={gutterRef}
            activeId={activeId}
          />
          <DragDropZone
            scrollContainerRef={contentRef}
            range={props.range}
            eventService={props.eventService}
          >
            {renderDays(props.range)}
          </DragDropZone>
        </div>
      </Flex>
    </DndContext>
  )
}

TimeGrid.defaultProps = {
  step: 15,
  timeslots: 4,
}

export default TimeGrid
