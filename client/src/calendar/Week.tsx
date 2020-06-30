import React from 'react'
import * as dates from '../util/dates'
import { startOfWeek, weekRangeFormat } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'

function getRange(date: Date) {
  const firstOfWeek = startOfWeek()
  const start = dates.startOf(date, 'week', firstOfWeek)
  const end = dates.endOf(date, 'week', firstOfWeek)

  return dates.range(start, end)
}

function getTitle(date: Date): string {
  const [start, ...rest] = getRange(date)
  return weekRangeFormat(start, rest.pop())
}

function Week(props: { events: Event[] }) {
  const range = getRange(new Date())
  const title = getTitle(new Date())

  return <TimeGrid events={props.events} range={range} />
}

export default Week
