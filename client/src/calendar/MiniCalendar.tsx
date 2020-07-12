import clsx from 'clsx'
import chunk from 'lodash/chunk'

import * as dates from '../util/dates'
import { startOfWeek, getWeekRange } from '../util/localizer'
import { format } from '../util/localizer'

interface IProps {
  selectedDate: Date
}

/**
 * Mini calendar for date selection.
 */
export default function MiniCalendar(props: IProps) {
  const today = new Date()
  const month = dates.visibleDays(props.selectedDate, startOfWeek())
  const weeks = chunk(month, 7)

  function renderHeader() {
    const range = getWeekRange(props.selectedDate)
    return range.map((day, idx) => (
      <div key={idx} className="cal-mini-month-day">
        {format(day, 'dd')}
      </div>
    ))
  }

  function renderWeek(week: Date[], idx: number) {
    return (
      <div key={idx} className="cal-mini-month-row">
        {week.map((day: Date, idx) => {
          const label = format(day, 'D')
          const isToday = dates.eq(day, today, 'day')
          return (
            <div
              key={idx}
              className={clsx('cal-mini-month-day', isToday && 'cal-mini-month-today-bg')}
            >
              {label}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mb-2 mt-5">
      <div className="cal-mini-month-header has-text-left pl-1">
        {format(props.selectedDate, 'MMMM YYYY')}
      </div>
      <div className="cal-mini-month-row">{renderHeader()}</div>
      {weeks.map(renderWeek)}
    </div>
  )
}
