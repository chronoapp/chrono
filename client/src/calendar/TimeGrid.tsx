import React from 'react'
import scrollbarSize from 'dom-helpers/scrollbarSize'

import * as dates from '../util/dates'
import Event from '../models/Event'
import DayColumn from './DayColumn'
import TimeGridHeader from './TimeGridHeader'
import SlotMetrics from './utils/SlotMetrics'
import { timeFormatShort } from '../util/localizer'

function remToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}

interface IProps {
  range: Date[]
  step: number
  timeslots: number
  min: Date
  max: Date
  events: Event[]
}

interface IState {
  gutterWidth: number
  scrollbarSize: number
}

const GUTTER_LINE_WIDTH = 0.5

class TimeGrid extends React.Component<IProps, IState> {
  private slotMetrics: SlotMetrics
  private gutterRef

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

    this.state = {
      gutterWidth: 0,
      scrollbarSize: 0,
    }
  }

  componentDidMount() {
    if (this.gutterRef) {
      const { current } = this.gutterRef
      const width = remToPixels(GUTTER_LINE_WIDTH) + current.getBoundingClientRect().width
      this.setState({ gutterWidth: width, scrollbarSize: scrollbarSize() })
    }
  }

  private renderDays(range: Date[]) {
    return range.map((date, jj) => {
      const dayEvents = this.props.events.filter(
        (event) => dates.inRange(date, event.start, event.end, 'day') && !event.isAllDay
      )

      return (
        <DayColumn
          key={jj}
          events={dayEvents}
          date={date}
          step={this.props.step}
          timeslots={this.props.timeslots}
          min={dates.merge(date, this.props.min)}
          max={dates.merge(date, this.props.max)}
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
        {idx === 0 ? null : <span className="cal-time-gutter-label">{timeRange}</span>}
      </div>
    )
  }

  public render() {
    const { gutterWidth, scrollbarSize } = this.state

    return (
      <div className="cal-time-view">
        <TimeGridHeader
          range={this.props.range}
          leftPad={gutterWidth}
          marginRight={scrollbarSize}
        />

        <div className="cal-time-content">
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
          {this.renderDays(this.props.range)}
        </div>
      </div>
    )
  }
}

export default TimeGrid
