import React from 'react'
import scrollbarSize from 'dom-helpers/scrollbarSize'
import { Box } from '@chakra-ui/react'

import * as dates from '../util/dates'
import Event from '../models/Event'
import DayColumn from './DayColumn'
import TimeGridHeader from './TimeGridHeader'
import DragDropZone from './DragDropZone'
import SlotMetrics from './utils/SlotMetrics'
import { timeFormatShort } from '../util/localizer'
import { inRange, sortEvents } from './utils/eventLevels'
import { GlobalEvent } from '../util/global'
import { EventService } from '@/calendar/event-edit/useEventService'
import Calendar from '@/models/Calendar'

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

interface IState {
  gutterWidth: number
  scrollbarSize: number
}

const GUTTER_LINE_WIDTH = 0.5

class TimeGrid extends React.Component<IProps, IState> {
  private slotMetrics: SlotMetrics
  private gutterRef
  private contentRef
  private scrollTopRatio?: number = undefined

  static defaultProps = {
    step: 15,
    timeslots: 4,
    min: dates.startOf(new Date(), 'day'),
    max: dates.endOf(new Date(), 'day'),
  }

  constructor(props: IProps) {
    super(props)

    this.slotMetrics = new SlotMetrics(props.min, props.max, props.step, props.timeslots)
    this.gutterRef = React.createRef()
    this.contentRef = React.createRef()

    this.state = {
      gutterWidth: 0,
      scrollbarSize: 0,
    }

    this.scrollToEvent = this.scrollToEvent.bind(this)
    this.calculateTopScroll(props.events)
  }

  componentDidMount() {
    if (this.gutterRef) {
      const { current } = this.gutterRef
      const width = remToPixels(GUTTER_LINE_WIDTH) + current.getBoundingClientRect().width
      this.setState({ gutterWidth: width, scrollbarSize: scrollbarSize() })
    }

    this.applyTopScroll()

    document.addEventListener(GlobalEvent.scrollToEvent, this.scrollToEvent)
  }

  componentDidUpdate() {
    this.applyTopScroll()
  }

  componentWillUnmount() {
    document.removeEventListener(GlobalEvent.scrollToEvent, this.scrollToEvent)
  }

  /**
   * Scrolls to time, defaults to now if date in event.detail is unspecified.
   */
  private scrollToEvent(event) {
    const { min, max, now } = this.props
    const scrollToDate = event.detail ? event.detail : now

    const totalMillis = dates.diff(max, min)
    const diffMillis = scrollToDate.getTime() - dates.startOf(scrollToDate, 'day').getTime()
    const scrollTopRatio = diffMillis / totalMillis

    const content = this.contentRef.current
    const padding = content.scrollHeight * 0.2

    const scrollTop = Math.max(0, content.scrollHeight * scrollTopRatio - padding)
    content.scrollTo({ top: scrollTop, behavior: 'smooth' })
  }

  /**
   * Makes sure the content is centered at a reasonable place.
   */
  private calculateTopScroll(events: Event[]) {
    const { min, max, now, range } = this.props
    const totalMillis = dates.diff(max, min)

    if (now >= range[0] && now <= range[range.length - 1]) {
      const diffMillis = (now.getTime() - dates.startOf(now, 'day').getTime()) / 1.1
      this.scrollTopRatio = diffMillis / totalMillis
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

    this.scrollTopRatio = avgFromTop
  }

  /**
   * Only adjust scroll once so it doesn't jump around.
   */
  private applyTopScroll() {
    if (this.scrollTopRatio) {
      const content = this.contentRef.current
      const scrollTop = content.scrollHeight * this.scrollTopRatio
      content.scrollTop = scrollTop
      this.scrollTopRatio = undefined
    }
  }

  private renderDays(range: Date[]) {
    return range.map((date, jj) => {
      const startOfDay = dates.merge(date, this.props.min)
      const dayEvents = this.props.events.filter(
        (event) =>
          dates.inRange(date, event.start, event.end, 'day') &&
          !event.all_day &&
          !dates.eq(event.end, startOfDay) // Ignore if event ends exactly on start of this day.
      )

      return (
        <DayColumn
          key={jj}
          events={dayEvents}
          date={date}
          step={this.props.step}
          timeslots={this.props.timeslots}
          min={startOfDay}
          max={dates.merge(date, this.props.max)}
          isCurrentDay={dates.eq(date, this.props.now, 'day')}
          now={this.props.now}
          eventService={this.props.eventService}
          primaryCalendar={this.props.primaryCalendar}
        />
      )
    })
  }

  private renderDateTick(idx: number) {
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

  private renderDateLabel(group: Date[], idx: number) {
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

  public render() {
    const { gutterWidth, scrollbarSize } = this.state

    const start = this.props.range[0]
    const end = this.props.range[this.props.range.length - 1]
    const allDayEvents = this.props.events
      .filter((event) => event.all_day && inRange(event, start, end))
      .sort((a, b) => sortEvents(a, b))

    return (
      <div className="cal-time-view">
        <TimeGridHeader
          events={allDayEvents}
          range={this.props.range}
          leftPad={gutterWidth}
          marginRight={scrollbarSize}
          eventService={this.props.eventService}
        />

        <div ref={this.contentRef} className="cal-time-content">
          <div ref={this.gutterRef} className="cal-time-gutter">
            {this.slotMetrics.groups.map((group, idx) => {
              return this.renderDateLabel(group, idx)
            })}
          </div>

          <div className="cal-time-gutter">
            {this.slotMetrics.groups.map((_group, idx) => {
              return this.renderDateTick(idx)
            })}
          </div>

          <DragDropZone
            scrollContainerRef={this.contentRef}
            range={this.props.range}
            eventService={this.props.eventService}
          >
            {this.renderDays(this.props.range)}
          </DragDropZone>
        </div>
      </div>
    )
  }
}

export default TimeGrid
