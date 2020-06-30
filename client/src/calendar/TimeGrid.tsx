import React, { useState, useCallback } from 'react'

import * as dates from '../util/dates'
import Event from '../models/Event'
import DayColumn from './DayColumn'
import TimeGridHeader from './TimeGridHeader'
import SlotMetrics from '../util/SlotMetrics'
import { format } from '../util/localizer'

function remToPixels(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize)
}

function TimeGrid(props: {
  range: Date[]
  step: number
  timeslots: number
  min: Date
  max: Date
  events: Event[]
}) {
  const GUTTER_LINE_WIDTH = 0.5
  const [gutterWidth, setGutterWidth] = useState(0)
  const slotMetrics = new SlotMetrics(props.min, props.max, props.step, props.timeslots)

  const gutterRef = useCallback((node) => {
    if (node !== null) {
      const width = remToPixels(GUTTER_LINE_WIDTH) + node.getBoundingClientRect().width
      setGutterWidth(width)
    }
  }, [])

  function renderDays(range: Date[]) {
    return range.map((date, jj) => {
      const dayEvents = props.events.filter((event) =>
        dates.inRange(date, event.start, event.end, 'day')
      )

      return (
        <DayColumn
          key={jj}
          events={dayEvents}
          date={date}
          step={props.step}
          timeslots={props.timeslots}
          min={dates.merge(date, props.min)}
          max={dates.merge(date, props.max)}
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
    const timeRange = format(group[0], 'LT')

    return (
      <div className="cal-time-gutter-box" key={idx}>
        {idx === 0 ? null : <span className="cal-time-gutter-label">{timeRange}</span>}
      </div>
    )
  }

  return (
    <div className="cal-time-view">
      <TimeGridHeader range={props.range} leftPad={gutterWidth} />

      <div className="cal-time-content">
        <div ref={gutterRef} className="cal-time-gutter">
          {slotMetrics.groups.map((group, idx) => {
            return renderDateLabel(group, idx)
          })}
        </div>
        <div className="cal-time-gutter">
          {slotMetrics.groups.map((_group, idx) => {
            return renderDateTick(idx)
          })}
        </div>
        {renderDays(props.range)}
      </div>
    </div>
  )
}

TimeGrid.defaultProps = {
  step: 30,
  timeslots: 2,
  min: dates.startOf(new Date(), 'day'),
  max: dates.endOf(new Date(), 'day'),
}

export default TimeGrid
