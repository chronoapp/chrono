import React, { useContext } from 'react'
import clsx from 'clsx'
import DateSlotMetrics from './utils/DateSlotMetrics'
import { updateEvent, getAuthToken } from '../util/Api'
import { FiCheck } from 'react-icons/fi'

import EventRow from './EventRow'
import Event from '../models/Event'
import Alert from '../models/Alert'

import WeekRowContainer from './WeekRowContainer'
import { AlertsContext } from '../components/AlertsContext'
import { EventActionContext } from './EventActionContext'

interface IProps {
  range: Date[]
  events: Event[]
}

const CELL_WRAPPER_CLS = 'cal-allday-cell'

/**
 * Top of week view.
 * Merge with WeekRow?
 */
function WeekHeaderRow(props: IProps) {
  const dayMetrics = new DateSlotMetrics(props.range, props.events, 8, 1)
  const alertsContext = useContext(AlertsContext)
  const eventActionContext = useContext(EventActionContext)

  function renderBackgroundCells() {
    return (
      <div className="cal-row-bg">
        {props.range.map((date, index) => {
          return <div key={index} className={clsx('cal-day-bg')}></div>
        })}
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
            icon: FiCheck,
            removeAlertId: alert.id,
            autoDismiss: true,
          })
        )
      })
  }

  return (
    <div className={CELL_WRAPPER_CLS}>
      {renderBackgroundCells()}
      <div className="cal-row-content">
        <WeekRowContainer
          dayMetrics={dayMetrics}
          onUpdatedEvent={onUpdatedEvent}
          rowClassname={CELL_WRAPPER_CLS}
          wrapperClassname={'cal-time-header-content'}
          ignoreNewEventYBoundCheck={true}
        >
          {dayMetrics.levels.map((segments, idx) => (
            <EventRow key={idx} isPreview={false} segments={segments} slotMetrics={dayMetrics} />
          ))}
        </WeekRowContainer>
      </div>
    </div>
  )
}

export default WeekHeaderRow
