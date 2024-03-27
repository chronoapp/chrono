import { ZonedDateTime as DateTime } from '@js-joda/core'

import { formatWeekRange, getWorkWeekRange } from '@/util/localizer-joda'

import Event from '@/models/Event'
import Calendar from '@/models/Calendar'

import TimeGrid from './TimeGrid'
import { EventService } from './event-edit/useEventService'

interface IProps {
  events: Event[]
  date: DateTime
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
  today: DateTime
}

function WorkWeek(props: IProps) {
  const range = getWorkWeekRange(props.date)

  return (
    <TimeGrid
      now={props.now}
      events={props.events}
      range={range}
      eventService={props.eventService}
      primaryCalendar={props.primaryCalendar}
      today={props.today}
    />
  )
}

WorkWeek.getTitle = function (date: DateTime): string {
  const [start, ...rest] = getWorkWeekRange(date)
  return formatWeekRange(start, rest.pop()!)
}

export default WorkWeek
