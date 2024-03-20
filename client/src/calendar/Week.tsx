import React from 'react'

import { EventService } from './event-edit/useEventService'
import { formatWeekRange, getWeekRange } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'
import Calendar from '@/models/Calendar'

interface IProps {
  events: Event[]
  date: Date
  eventService: EventService
  primaryCalendar: Calendar
}

function Week(props: IProps) {
  const range = getWeekRange(props.date)
  const now = new Date()

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

Week.getTitle = function (date: Date): string {
  const [start, ...rest] = getWeekRange(date)
  return formatWeekRange(start, rest.pop()!)
}

export default Week
