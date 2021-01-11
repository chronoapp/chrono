import React, { useContext, useState, useEffect } from 'react'
import clsx from 'clsx'
import chunk from 'lodash/chunk'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

import * as dates from '../util/dates'
import { startOfWeek, getWeekRange } from '../util/localizer'
import { format } from '../util/localizer'
import { EventActionContext, EventActionContextType } from './EventActionContext'

type AnimateDirection = 'NONE' | 'FROM_BOTTOM' | 'FROM_TOP'

/**
 * Mini calendar for date selection.
 */
export default function MiniCalendar() {
  const eventsContext = useContext<EventActionContextType>(EventActionContext)
  const today = new Date()

  // Current view date (represents a month) of the calendar.
  const [viewDate, setViewDate] = useState<Date>(eventsContext.selectedDate)

  const month = dates.visibleDays(viewDate, startOfWeek(), true)
  const weeks = chunk(month, 7)
  const [animateDirection, setAnimateDirection] = useState<AnimateDirection>('NONE')

  useEffect(() => {
    setViewDate(eventsContext.selectedDate)
  }, [eventsContext.selectedDate])

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
          const isSelected = dates.eq(day, eventsContext.selectedDate, 'day')

          return (
            <div
              key={idx}
              onClick={() => eventsContext.setSelectedDate(day)}
              className={clsx(
                'cal-mini-month-day',
                !isToday && isOffRange && 'has-text-grey',
                !isToday && isSelected && 'cal-mini-month-day-selected',
                isToday && 'cal-mini-month-today-bg'
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
    <div className="mt-3">
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
            <FiChevronUp size={'1.25em'} />
          </span>
          <span
            className="icon-button ml-1"
            onClick={() => {
              setAnimateDirection('FROM_BOTTOM')
              setViewDate(dates.add(viewDate, 1, 'month'))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <FiChevronDown size={'1.25em'} />
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
