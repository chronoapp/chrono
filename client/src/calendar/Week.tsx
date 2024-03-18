import { ZonedDateTime as DateTime } from '@js-joda/core'
import { formatWeekRange, getWeekRange } from '../util/localizer-joda'

import { EventService } from './event-edit/useEventService'

import TimeGrid from './TimeGrid'
import Event from '../models/Event'
import Calendar from '@/models/Calendar'

interface IProps {
  events: Event[]
  date: DateTime
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
  today: Date
}

function Week(props: IProps) {
  const range = getWeekRange(props.date)

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

Week.getTitle = function (date: DateTime): string {
  const [start, ...rest] = getWeekRange(date)
  return formatWeekRange(start, rest.pop()!)
}

export default Week
