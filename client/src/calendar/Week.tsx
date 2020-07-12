import React from 'react'
import * as dates from '../util/dates'
import { startOfWeek, weekRangeFormat, getWeekRange } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'

function getTitle(date: Date): string {
  const [start, ...rest] = getWeekRange(date)
  return weekRangeFormat(start, rest.pop())
}

function Week(props: { events: Event[] }) {
  const range = getWeekRange(new Date())
  const title = getTitle(new Date())

  return <TimeGrid events={props.events} range={range} />
}

export default Week
