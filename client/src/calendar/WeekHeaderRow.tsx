import { useRecoilValue } from 'recoil'
import { ZonedDateTime as DateTime } from '@js-joda/core'

import DateSlotMetrics from './utils/DateSlotMetrics'
import EventRow from './EventRow'
import Event from '../models/Event'

import WeekRowContainer from './WeekRowContainer'
import EventEndingRow from './EventEndingRow'
import { EventService } from './event-edit/useEventService'

import { primaryCalendarSelector } from '@/state/CalendarState'

import { Box } from '@chakra-ui/react'

interface IProps {
  range: DateTime[]
  events: Event[]
  eventService: EventService
  expandRows: boolean
  onShowMore: () => void
}
/**
 * Top of week view. Similar to WeekRow except there is no limit for number of rows.
 *
 * TODO: Merge with WeekRow?
 */
function WeekHeaderRow(props: IProps) {
  const maxRows = props.expandRows ? Infinity : 2
  const dayMetrics = new DateSlotMetrics(props.range, props.events, maxRows, 1)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

  function renderBackgroundCells() {
    return (
      <Box
        className="cal-row-bg"
        display="flex"
        flexDirection="row"
        flex="1 0 0%"
        overflow="hidden"
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
      >
        {props.range.map((date, index) => (
          <Box
            key={index}
            className="cal-day-bg"
            flex="1 0 0%"
            borderLeft="1px solid"
            borderColor="rgb(235, 235, 235)"
          />
        ))}
      </Box>
    )
  }

  return (
    <Box className="cal-allday-cell" boxSizing="content-box" w="100%" h="100%" position="relative">
      {renderBackgroundCells()}
      <Box className="cal-row-content">
        <WeekRowContainer
          primaryCalendar={primaryCalendar!}
          dayMetrics={dayMetrics}
          rowClassname="cal-allday-cell"
          wrapperClassname="cal-time-header-content"
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
              now={DateTime.now()}
              eventService={props.eventService}
              onShowMore={() => props.onShowMore()}
            />
          )}
        </WeekRowContainer>
      </Box>
    </Box>
  )
}

export default WeekHeaderRow
