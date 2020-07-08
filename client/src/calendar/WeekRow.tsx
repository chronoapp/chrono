import React from 'react'
import clsx from 'clsx'
import * as dates from '../util/dates'
import { format } from '../util/localizer'

interface IProps {
  key: number
  date: Date
  range: Date[]
}

function WeekRow(props: IProps) {
  function renderBackgroundCells() {
    return (
      <div className="cal-row-bg">
        {props.range.map((date, index) => {
          return (
            <div
              className={clsx(
                'cal-day-bg',
                dates.month(props.date) !== dates.month(date) && 'cal-off-range-bg'
              )}
            ></div>
          )
        })}
      </div>
    )
  }

  function renderHeadingCell(date: Date, index: number) {
    const label = format(date, 'DD')
    return (
      <div key={`header_${index}`} className="cal-date-cell">
        {label}
      </div>
    )
  }

  return (
    <div className="cal-month-row">
      {renderBackgroundCells()}

      <div className="cal-row-content">
        <div className="cal-row">{props.range.map(renderHeadingCell)}</div>
      </div>
    </div>
  )
}

export default WeekRow
