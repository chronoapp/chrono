import React from 'react'
import clsx from 'clsx'
import DateSlotMetrics from './utils/DateSlotMetrics'

import EventRow from './EventRow'
import Event from '../models/Event'

import WeekRowContainer from './WeekRowContainer'
import useEventService from './event-edit/useEventService'

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
  const { updateEvent } = useEventService()

  function renderBackgroundCells() {
    return (
      <div className="cal-row-bg">
        {props.range.map((date, index) => {
          return <div key={index} className={clsx('cal-day-bg')}></div>
        })}
      </div>
    )
  }

  return (
    <div className={CELL_WRAPPER_CLS}>
      {renderBackgroundCells()}
      <div className="cal-row-content">
        <WeekRowContainer
          dayMetrics={dayMetrics}
          onUpdatedEvent={updateEvent}
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
