import React from 'react'
import clsx from 'clsx'

import { format } from '../util/localizer'
import * as dates from '../util/dates'

import Event from '../models/Event'
import WeekHeaderRow from './WeekHeaderRow'

interface IProps {
  range: Date[]
  events: Event[]
  leftPad: number
  marginRight: number
}

function TimeGridHeader(props: IProps) {
  function renderHeaderCells() {
    const today = new Date() // TODO: pass via props.

    return props.range.map((date, i) => {
      const dayNumber = format(date, 'DD')
      const dateString = format(date, 'ddd')
      const isToday = dates.eq(date, today, 'day')

      return (
        <div key={i} className={clsx('cal-header', dates.eq(date, today, 'day') && 'cal-today')}>
          <span className={clsx(isToday && 'cal-header-day-selected', 'cal-header-day')}>
            {dateString}
          </span>
          <div className={clsx('is-size-5', isToday && 'cal-today-bg')}>{dayNumber}</div>
        </div>
      )
    })
  }

  // TODO: Add space for gutter
  return (
    <div style={{ marginRight: props.marginRight }} className={clsx('cal-time-header')}>
      <div style={{ width: props.leftPad }} className="rbc-label cal-time-header-gutter" />
      <div className="cal-time-header-content">
        <div className="cal-row">{renderHeaderCells()}</div>
        <WeekHeaderRow range={props.range} events={props.events} />
      </div>
    </div>
  )
}

export default TimeGridHeader
