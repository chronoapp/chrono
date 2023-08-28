import { useRef, useState, useEffect } from 'react'
import { useRecoilValue } from 'recoil'

import getScrollbarSize from 'dom-helpers/scrollbarSize'
import { Box } from '@chakra-ui/react'

import * as dates from '../util/dates'
import Event from '../models/Event'
import DayColumnFunc from './DayColumnFunc'
import TimeGridHeader from './TimeGridHeader'
import DragDropZone from './DragDropZone'
import SlotMetrics from './utils/SlotMetrics'
import { timeFormatShort } from '../util/localizer'
import { inRange, sortEvents } from './utils/eventLevels'
import { GlobalEvent } from '../util/global'
import { EventService } from '@/calendar/event-edit/useEventService'
import Calendar from '@/models/Calendar'

import { editingEventState } from '@/state/EventsState'
import { dragDropActionState } from '@/state/EventsState'

function remToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}

interface IProps {
  step: number
  timeslots: number
  min: Date
  max: Date
  range: Date[]
  events: Event[]
  now: Date
  eventService: EventService
  primaryCalendar: Calendar
}

const GUTTER_LINE_WIDTH = 0.5

function preventScroll(e) {
  e.preventDefault()
}

function TimeGrid(props: IProps) {
  const [gutterWidth, setGutterWidth] = useState(0)
  const [scrollbarSize, setScrollbarSize] = useState(0)

  const slotMetrics = useRef<SlotMetrics>(
    new SlotMetrics(props.min, props.max, props.step, props.timeslots)
  )
  const gutterRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLInputElement>(null)
  const scrollTopRatio = useRef<number | undefined>(undefined)

  const editingEvent = useRecoilValue(editingEventState)
  const dragAndDropAction = useRecoilValue(dragDropActionState)

  useEffect(() => {
    const scrollbarSize = getScrollbarSize()

    // Adjust gutter width to account for scrollbar.
    if (gutterRef.current) {
      const width = remToPixels(GUTTER_LINE_WIDTH) + gutterRef.current.getBoundingClientRect().width
      setGutterWidth(width)
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
    const { min, max, now } = props
    const scrollToDate = event.detail ? event.detail : now

    const totalMillis = dates.diff(max, min)
    const diffMillis = scrollToDate.getTime() - dates.startOf(scrollToDate, 'day').getTime()
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
    const { min, max, now, range } = props
    const totalMillis = dates.diff(max, min)

    if (now >= range[0] && now <= range[range.length - 1]) {
      const diffMillis = (now.getTime() - dates.startOf(now, 'day').getTime()) / 1.1
      scrollTopRatio.current = diffMillis / totalMillis
    }

    if (!events || !events.length) {
      return
    }

    const sampleSize = Math.min(events.length, 3)
    let avgFromTop = 0
    for (let i = 0; i < sampleSize; i++) {
      const scrollToTime = events[i].start
      const diffMillis = scrollToTime.getTime() - dates.startOf(scrollToTime, 'day').getTime()
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

  function renderDays(range: Date[]) {
    return range.map((date, jj) => {
      const startOfDay = dates.merge(date, props.min)
      const dayEvents = props.events.filter(
        (event) =>
          dates.inRange(date, event.start, event.end, 'day') &&
          !event.all_day &&
          !dates.eq(event.end, startOfDay) // Ignore if event ends exactly on start of this day.
      )

      return (
        <DayColumnFunc
          key={jj}
          events={dayEvents}
          date={date}
          step={props.step}
          timeslots={props.timeslots}
          min={startOfDay}
          max={dates.merge(date, props.max)}
          isCurrentDay={dates.eq(date, props.now, 'day')}
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

  function renderDateLabel(group: Date[], idx: number) {
    const timeRange = timeFormatShort(group[0], true).toUpperCase()

    return (
      <div className="cal-time-gutter-box" key={idx}>
        {idx === 0 ? null : (
          <Box className="cal-time-gutter-label" color="gray.600">
            {timeRange}
          </Box>
        )}
      </div>
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
        leftPad={gutterWidth}
        marginRight={scrollbarSize}
        eventService={props.eventService}
      />

      <div ref={contentRef} className="cal-time-content">
        <div ref={gutterRef} className="cal-time-gutter">
          {slotMetrics.current.groups.map((group, idx) => {
            return renderDateLabel(group, idx)
          })}
        </div>

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
  min: dates.startOf(new Date(), 'day'),
  max: dates.endOf(new Date(), 'day'),
}

export default TimeGrid
