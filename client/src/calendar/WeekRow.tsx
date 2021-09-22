import React from 'react'
import clsx from 'clsx'

import * as dates from '../util/dates'
import { format } from '../util/localizer'
import DateSlotMetrics from './utils/DateSlotMetrics'

import Event from '../models/Event'
import EventRow from './EventRow'
import WeekRowContainer from './WeekRowContainer'
import useEventService from './event-edit/useEventService'
import EventEndingRow from './EventEndingRow'

interface IProps {
  key: number
  today: Date
  date: Date
  range: Date[]
  events: Event[]
  loading: boolean
  showDatesOfWeek: boolean
}

const MIN_ROWS = 1
const MAX_ROWS = 5

/**
 * Row used for month and full day events in the week view.
 * TODO: Handle Show More.
 */
function WeekRow(props: IProps) {
  const { updateEvent } = useEventService()

  const dayMetrics = new DateSlotMetrics(props.range, props.events, MAX_ROWS, MIN_ROWS)

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
    let isCurrent = dates.eq(date, props.today, 'day')

    return (
      <div key={`header_${index}`} className={clsx('cal-date-cell', isOffRange && 'cal-off-range')}>
        {props.showDatesOfWeek && <div>{format(date, 'ddd')}</div>}
        <div className={clsx(isCurrent && 'cal-today-bg-month')}>{label}</div>
      </div>
    )
  }

  return (
    <div className="cal-row-wrapper">
      {renderBackgroundCells()}

      <div className="cal-row-content">
        <div className="cal-row">{props.range.map(renderHeadingCell)}</div>

        <WeekRowContainer
          dayMetrics={dayMetrics}
          onUpdatedEvent={updateEvent}
          rowClassname="cal-row-wrapper"
          wrapperClassname="cal-month-view"
          ignoreNewEventYBoundCheck={false}
        >
          {!props.loading && (
            <>
              {dayMetrics.levels.map((segments, idx) => (
                <EventRow
                  key={idx}
                  segments={segments}
                  slotMetrics={dayMetrics}
                  isPreview={false}
                />
              ))}

              {!!dayMetrics.extra.length && (
                <EventEndingRow
                  segments={dayMetrics.extra}
                  slots={dayMetrics.slots}
                  now={props.today}
                />
              )}
            </>
          )}
        </WeekRowContainer>
      </div>
    </div>
  )
}

export default WeekRow
