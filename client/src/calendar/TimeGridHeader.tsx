import React from 'react'
import clsx from 'clsx'
import { format } from '../util/localizer'
import * as dates from '../util/dates'

function TimeGridHeader(props: { range: Date[]; leftPad: number; marginRight: number }) {
  function renderHeaderCells() {
    const today = new Date() // TODO: pass via props.

    return props.range.map((date, i) => {
      const dateString = format(date, 'DD ddd')
      return (
        <div key={i} className={clsx('cal-header', dates.eq(date, today, 'day') && 'cal-today')}>
          <span>{dateString}</span>
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
      </div>
    </div>
  )
}

export default TimeGridHeader
