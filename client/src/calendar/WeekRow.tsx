import React from 'react'
import clsx from 'clsx'

import * as dates from '../util/dates'
import { format } from '../util/localizer'
import Event from '../models/Event'
import DateSlotMetrics from './utils/DateSlotMetrics'
import EventRow from './EventRow'

interface IProps {
  key: number
  date: Date
  range: Date[]
  events: Event[]
}

/**
 * Row used for month and full day events in the week view.
 */
function WeekRow(props: IProps) {
  function renderBackgroundCells() {
    return (
      <div className="cal-row-bg">
        {props.range.map((date, index) => {
          const isOffRange = dates.month(props.date) !== dates.month(date)
          return (
            <div key={index} className={clsx('cal-day-bg', isOffRange && 'cal-off-range-bg')}></div>
          )
        })}
      </div>
    )
  }

  function renderHeadingCell(date: Date, index: number) {
    const label = format(date, 'DD')
    const isOffRange = dates.month(props.date) !== dates.month(date)
    let isCurrent = dates.eq(date, props.date, 'day')

    return (
      <div key={`header_${index}`} className={clsx('cal-date-cell', isOffRange && 'cal-off-range')}>
        <div className={clsx(isCurrent && 'cal-current-day-bg-month')}>{label}</div>
      </div>
    )
  }

  const dayMetrics = new DateSlotMetrics(props.range, props.events, 5, 1)

  return (
    <div className="cal-month-row">
      {renderBackgroundCells()}

      <div className="cal-row-content">
        <div className="cal-row">{props.range.map(renderHeadingCell)}</div>

        {dayMetrics.levels.map((segments, idx) => (
          <EventRow key={idx} segments={segments} slotMetrics={dayMetrics} />
        ))}
      </div>
    </div>
  )
}

export default WeekRow
