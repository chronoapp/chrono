import React from 'react'
import clsx from 'clsx'
import DateSlotMetrics from './utils/DateSlotMetrics'

import EventRow from './EventRow'
import Event from '../models/Event'

interface IProps {
  range: Date[]
  events: Event[]
}

/**
 * Top of week view.
 * Merge with WeekRow?
 */
function WeekHeaderRow(props: IProps) {
  const dayMetrics = new DateSlotMetrics(props.range, props.events, 8, 1)

  function renderBackgroundCells() {
    return (
      <div className="cal-row-bg">
        {props.range.map((date, index) => {
          return <div key={index} className={clsx('cal-day-bg')}></div>
        })}
      </div>
    )
  }

  return (
    <div className="cal-allday-cell">
      {renderBackgroundCells()}
      <div className="cal-row-content">
        {dayMetrics.levels.map((segments, idx) => (
          <EventRow key={idx} segments={segments} slotMetrics={dayMetrics} />
        ))}
      </div>
    </div>
  )
}

export default WeekHeaderRow
