import React, { useContext } from 'react'
import clsx from 'clsx'
import { mdiCheck } from '@mdi/js'

import * as dates from '../util/dates'
import { format } from '../util/localizer'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { updateEvent, getAuthToken } from '../util/Api'

import Event from '../models/Event'
import Alert from '../models/Alert'

import EventRow from './EventRow'
import WeekRowContainer from './WeekRowContainer'
import { AlertsContext } from '../components/AlertsContext'
import { EventActionContext } from './EventActionContext'

interface IProps {
  key: number
  today: Date
  date: Date
  range: Date[]
  events: Event[]
  loading: boolean
}

const MIN_ROWS = 1
const MAX_ROWS = 6

/**
 * Row used for month and full day events in the week view.
 * TODO: Handle Show More.
 */
function WeekRow(props: IProps) {
  const dayMetrics = new DateSlotMetrics(props.range, props.events, MAX_ROWS, MIN_ROWS)
  const alertsContext = useContext(AlertsContext)
  const eventActionContext = useContext(EventActionContext)

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
        <div className={clsx(isCurrent && 'cal-today-bg-month')}>{label}</div>
      </div>
    )
  }

  function onUpdatedEvent(event: Event) {
    const alert = new Alert({ title: 'Saving Event..', isLoading: true })
    alertsContext.addAlert(alert)

    // TODO: Queue overrides from server to prevent race condition.
    updateEvent(getAuthToken(), event)
      .then((newEvent) => {
        eventActionContext.eventDispatch({
          type: 'UPDATE_EVENT',
          payload: { event: newEvent, replaceEventId: event.id },
        })
      })
      .then(() => {
        alertsContext.addAlert(
          new Alert({
            title: 'Event Updated.',
            iconType: mdiCheck,
            removeAlertId: alert.id,
            autoDismiss: true,
          })
        )
      })
  }

  return (
    <div className="cal-month-row">
      {renderBackgroundCells()}

      <div className="cal-row-content">
        <div className="cal-row">{props.range.map(renderHeadingCell)}</div>

        <WeekRowContainer dayMetrics={dayMetrics} onUpdatedEvent={onUpdatedEvent}>
          {!props.loading &&
            dayMetrics.levels.map((segments, idx) => (
              <EventRow key={idx} segments={segments} slotMetrics={dayMetrics} isPreview={false} />
            ))}
        </WeekRowContainer>
      </div>
    </div>
  )
}

export default WeekRow
