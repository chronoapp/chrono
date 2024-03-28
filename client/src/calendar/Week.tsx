import { DateTime } from 'luxon'

import { EventService } from './event-edit/useEventService'
import { formatWeekRange, getWeekRange } from '../util/localizer-luxon'

import TimeGrid from './TimeGrid'
import Event from '../models/Event'
import Calendar from '@/models/Calendar'

interface IProps {
  events: Event[]
  date: DateTime
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
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
    />
  )
}

Week.getTitle = function (date: DateTime): string {
  const [start, ...rest] = getWeekRange(date)
  return formatWeekRange(start, rest.pop()!)
}

export default Week
