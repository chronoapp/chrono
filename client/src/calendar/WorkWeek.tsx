import { ZonedDateTime as DateTime } from '@js-joda/core'

import { formatWeekRange, getWorkWeekRange } from '@/util/localizer-joda'

import Event from '@/models/Event'
import Calendar from '@/models/Calendar'

import TimeGrid from './TimeGrid'
import { EventService } from './event-edit/useEventService'

interface IProps {
  events: Event[]
  date: DateTime
  eventService: EventService
  primaryCalendar: Calendar
}

function WorkWeek(props: IProps) {
  const range = getWorkWeekRange(props.date)
  const now = DateTime.now()

  return (
    <TimeGrid
      now={now}
      events={props.events}
      range={range}
      eventService={props.eventService}
      primaryCalendar={props.primaryCalendar}
    />
  )
}

WorkWeek.getTitle = function (date: DateTime): string {
  const [start, ...rest] = getWorkWeekRange(date)
  return formatWeekRange(start, rest.pop()!)
}

export default WorkWeek
