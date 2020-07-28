import React, { useContext, useState } from 'react'
import clsx from 'clsx'
import chunk from 'lodash/chunk'

import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp'

import * as dates from '../util/dates'
import { startOfWeek, getWeekRange } from '../util/localizer'
import { format } from '../util/localizer'
import { EventActionContext, EventActionContextType } from './EventActionContext'

interface IProps {
  selectedDate: Date
}

type AnimateDirection = 'NONE' | 'FROM_BOTTOM' | 'FROM_TOP'

/**
 * Mini calendar for date selection.
 */
export default function MiniCalendar(props: IProps) {
  const eventsContext = useContext<EventActionContextType>(EventActionContext)
  const today = new Date()

  // Current view date of the calendar.
  const [viewDate, setViewDate] = useState<Date>(eventsContext.selectedDate)
  const month = dates.visibleDays(viewDate, startOfWeek(), true)
  const weeks = chunk(month, 7)
  const [animateDirection, setAnimateDirection] = useState<AnimateDirection>('NONE')

  function renderHeader() {
    const range = getWeekRange(viewDate)
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
          const isOffRange = dates.month(viewDate) !== dates.month(day)
          return (
            <div
              key={idx}
              className={clsx(
                'cal-mini-month-day',
                isToday && 'cal-mini-month-today-bg',
                !isToday && isOffRange && 'has-text-grey'
              )}
            >
              {label}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mt-5">
      <div className="cal-mini-month-header has-text-left pl-1">
        <span>{format(viewDate, 'MMMM YYYY')}</span>
        <span>
          <span
            className="icon-button"
            onClick={() => {
              setAnimateDirection('FROM_TOP')
              setViewDate(dates.subtract(viewDate, 1, 'month'))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <KeyboardArrowUpIcon />
          </span>
          <span
            className="icon-button"
            onClick={() => {
              setAnimateDirection('FROM_BOTTOM')
              setViewDate(dates.add(viewDate, 1, 'month'))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <KeyboardArrowDownIcon />
          </span>
        </span>
      </div>
      <div className="cal-mini-month-row">{renderHeader()}</div>
      <div
        className={clsx(
          animateDirection === 'FROM_BOTTOM' && 'animate-bottom',
          animateDirection === 'FROM_TOP' && 'animate-top'
        )}
      >
        {weeks.map(renderWeek)}
      </div>
    </div>
  )
}
