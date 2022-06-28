import React from 'react'
import clsx from 'clsx'

import { format } from '../util/localizer'
import * as dates from '../util/dates'

import Event from '../models/Event'
import WeekHeaderRow from './WeekHeaderRow'
import { EventService } from './event-edit/useEventService'
interface IProps {
  range: Date[]
  events: Event[]
  leftPad: number
  marginRight: number
  eventService: EventService
}

function TimeGridHeader(props: IProps) {
  function renderHeaderCells() {
    const today = new Date() // TODO: pass via props.

    return props.range.map((date, i) => {
      const dayNumber = format(date, 'D')
      const dateString = format(date, 'ddd')
      const isToday = dates.eq(date, today, 'day')

      return (
        <div key={i} className={clsx('cal-header', dates.eq(date, today, 'day') && 'cal-today')}>
          <span className={clsx(isToday && 'cal-header-day-selected', 'cal-header-day')}>
            <div
              className={clsx(
                'cal-header-day-rectangle',
                !isToday && 'has-text-grey-dark',
                isToday && 'cal-today-bg'
              )}
            >
              <span className="is-size-6">{dayNumber}</span>{' '}
              <span className="is-size-7">{dateString}</span>
            </div>
          </span>
          <span className="cal-divider"></span>
        </div>
      )
    })
  }

  return (
    <div style={{ marginRight: props.marginRight }} className={clsx('cal-time-header', 'mt-2')}>
      <div style={{ width: props.leftPad }} className="rbc-label cal-time-header-gutter" />
      <div className="cal-time-header-content">
        <div className="cal-row">{renderHeaderCells()}</div>
        <WeekHeaderRow
          range={props.range}
          events={props.events}
          eventService={props.eventService}
        />
      </div>
    </div>
  )
}

export default TimeGridHeader
