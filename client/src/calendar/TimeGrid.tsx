import React, { useRef, useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import getScrollbarSize from 'dom-helpers/scrollbarSize'

import { ZonedDateTime as DateTime, ChronoUnit } from '@js-joda/core'
import { formatTimeShort } from '@/util/localizer-joda'
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

import { DndContext, closestCorners, DragOverlay, MouseSensor } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableGutter } from './SortableGutter'
import GutterContent from './GutterContent'

function remToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}
interface IProps {
  step: number
  timeslots: number
  range: DateTime[]
  events: Event[]
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
  today: DateTime
}

const GUTTER_LINE_WIDTH = 0.5

function preventScroll(e) {
  e.preventDefault()
}

function TimeGrid(props: IProps) {
  const [intitalGutterHeaderWidth, setIntitalGutterHeaderWidth] = useState(0)
  const [gutterWidth, setGutterWidth] = useState(0)
  const [scrollbarSize, setScrollbarSize] = useState(0)
  const [gutters, setGutters] = useState([{ id: 1 }])
  const [activeId, setActiveId] = useState(null)
  const getNextId = () => gutters.reduce((max, gutter) => Math.max(max, gutter.id), 0) + 1

  const addGutter = () => {
    const newGutter = { id: getNextId() }
    setGutters([...gutters, newGutter])
  }

  const min = dates.startOf(props.now, ChronoUnit.DAYS)
  const max = dates.endOf(props.now, ChronoUnit.DAYS)

  const slotMetrics = useRef<SlotMetrics>(new SlotMetrics(min, max, props.step, props.timeslots))

  function handleDragStart(event) {
    const { active } = event

    setActiveId(active.id)
  }

  const getGutterPos = (id) => gutters.findIndex((gutter) => gutter.id === id)

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id === over.id) return
    setGutters((gutters) => {
      const originalPos = getGutterPos(active.id)
      const newPos = getGutterPos(over.id)

      return arrayMove(gutters, originalPos, newPos)
    })
  }

  const restrictToXAxis = ({ transform }) => ({
    ...transform,
    y: 0, // Restrict movement to the x-axis by setting the y-coordinate to 0
  })

  const gutterRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    applyTopScroll()
  })

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

  function renderDateTick(idx: number) {
    return (
      <div
        className="cal-timeslot-group"
        key={idx}
        style={{
          width: `${GUTTER_LINE_WIDTH}rem`,
          borderLeft: 0,
        }}
      ></div>
    )
  }

  const start = props.range[0]
  const end = props.range[props.range.length - 1]
  const allDayEvents = props.events
    .filter((event) => event.all_day && inRange(event, start, end))
    .sort((a, b) => sortEvents(a, b))

  return (
    <div className="cal-time-view">
      <TimeGridHeader
        events={allDayEvents}
        range={props.range}
        leftPad={intitalGutterHeaderWidth + (gutters.length - 1) * gutterWidth}
        marginRight={scrollbarSize}
        eventService={props.eventService}
        now={props.now}
        addGutter={addGutter}
        today={props.today}
      />

      <div ref={contentRef} className="cal-time-content">
        <DndContext
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToXAxis]}
        >
          <SortableContext
            items={gutters.map((gutter) => gutter.id)}
            strategy={horizontalListSortingStrategy}
          >
            {/* Your existing component structure */}
            {gutters.map((gutter, index) => (
              <SortableGutter
                key={gutter.id}
                id={gutter.id}
                gutterRef={gutterRef}
                slotMetrics={slotMetrics}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <div style={{ boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.2)' }}>
                <GutterContent slotMetrics={slotMetrics} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <div className="cal-time-gutter">
          {slotMetrics.current.groups.map((_group, idx) => {
            return renderDateTick(idx)
          })}
        </div>

        <DragDropZone
          scrollContainerRef={contentRef}
          range={props.range}
          eventService={props.eventService}
        >
          {renderDays(props.range)}
        </DragDropZone>
      </div>
    </div>
  )
}

TimeGrid.defaultProps = {
  step: 15,
  timeslots: 4,
}

export default TimeGrid
