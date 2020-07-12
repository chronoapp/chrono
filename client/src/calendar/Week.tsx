import React from 'react'
import { weekRangeFormat, getWeekRange } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'

function Week(props: { events: Event[] }) {
  const range = getWeekRange(new Date())

  return <TimeGrid events={props.events} range={range} />
}

Week.getTitle = function (date: Date): string {
  const [start, ...rest] = getWeekRange(date)
  return weekRangeFormat(start, rest.pop())
}

export default Week
