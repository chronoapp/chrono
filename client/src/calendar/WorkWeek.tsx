import React from 'react'
import { weekRangeFormat, getWorkWeekRange } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'

interface IProps {
  events: Event[]
  date: Date
  updateEvent: (event: Event) => void
}

function WorkWeek(props: IProps) {
  const range = getWorkWeekRange(props.date)
  const now = new Date()

  return <TimeGrid now={now} events={props.events} range={range} updateEvent={props.updateEvent} />
}

WorkWeek.getTitle = function (date: Date): string {
  const [start, ...rest] = getWorkWeekRange(date)
  return weekRangeFormat(start, rest.pop()!)
}

export default WorkWeek
