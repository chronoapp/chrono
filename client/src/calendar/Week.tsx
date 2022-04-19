import React from 'react'

import { EventService } from './event-edit/useEventService'
import { weekRangeFormat, getWeekRange } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'

interface IProps {
  events: Event[]
  date: Date
  eventService: EventService
}

function Week(props: IProps) {
  const range = getWeekRange(props.date)
  const now = new Date()

  return (
    <TimeGrid now={now} events={props.events} range={range} eventService={props.eventService} />
  )
}

Week.getTitle = function (date: Date): string {
  const [start, ...rest] = getWeekRange(date)
  return weekRangeFormat(start, rest.pop()!)
}

export default Week
