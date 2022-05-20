import React from 'react'

import { weekRangeFormat, getWorkWeekRange } from '@/util/localizer'
import Event from '@/models/Event'
import Calendar from '@/models/Calendar'

import TimeGrid from './TimeGrid'
import { EventService } from './event-edit/useEventService'

interface IProps {
  events: Event[]
  date: Date
  eventService: EventService
  getPrimaryCalendar: () => Calendar
}

function WorkWeek(props: IProps) {
  const range = getWorkWeekRange(props.date)
  const now = new Date()

  return (
    <TimeGrid
      now={now}
      events={props.events}
      range={range}
      eventService={props.eventService}
      getPrimaryCalendar={props.getPrimaryCalendar}
    />
  )
}

WorkWeek.getTitle = function (date: Date): string {
  const [start, ...rest] = getWorkWeekRange(date)
  return weekRangeFormat(start, rest.pop()!)
}

export default WorkWeek
