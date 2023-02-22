import { useRecoilValue, useSetRecoilState } from 'recoil'
import clsx from 'clsx'
import DateSlotMetrics from './utils/DateSlotMetrics'
import EventRow from './EventRow'
import Event from '../models/Event'

import WeekRowContainer from './WeekRowContainer'
import EventEndingRow from './EventEndingRow'
import { EventService } from './event-edit/useEventService'

import { primaryCalendarSelector } from '@/state/CalendarState'
import { uiState } from '@/state/UIState'

interface IProps {
  range: Date[]
  events: Event[]
  eventService: EventService
  expandRows: boolean
}

const CELL_WRAPPER_CLS = 'cal-allday-cell'

/**
 * Top of week view. Similar to WeekRow except there is no limit for number of rows.
 *
 * TODO: Merge with WeekRow?
 */
function WeekHeaderRow(props: IProps) {
  const maxRows = props.expandRows ? Infinity : 2
  const dayMetrics = new DateSlotMetrics(props.range, props.events, maxRows, 1)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const setUiState = useSetRecoilState(uiState)

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
          primaryCalendar={primaryCalendar!}
          dayMetrics={dayMetrics}
          rowClassname={CELL_WRAPPER_CLS}
          wrapperClassname={'cal-time-header-content'}
          ignoreNewEventYBoundCheck={true}
          eventService={props.eventService}
        >
          {dayMetrics.levels.map((segments, idx) => (
            <EventRow
              key={idx}
              isPreview={false}
              segments={segments}
              slotMetrics={dayMetrics}
              eventService={props.eventService}
            />
          ))}

          {!!dayMetrics.extra.length && (
            <EventEndingRow
              segments={dayMetrics.extra}
              slots={dayMetrics.slots}
              now={new Date()}
              eventService={props.eventService}
              onShowMore={() => setUiState((state) => ({ ...state, expandWeeklyRows: true }))}
            />
          )}
        </WeekRowContainer>
      </div>
    </div>
  )
}

export default WeekHeaderRow
