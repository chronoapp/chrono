import React from 'react'
import { weekRangeFormat, getWeekRange } from '../util/localizer'
import TimeGrid from './TimeGrid'
import Event from '../models/Event'

interface IProps {
  events: Event[]
  date: Date
}

function Week(props: IProps) {
  const range = getWeekRange(props.date)

  return <TimeGrid events={props.events} range={range} />
}

Week.getTitle = function (date: Date): string {
  const [start, ...rest] = getWeekRange(date)
  return weekRangeFormat(start, rest.pop())
}

export default Week
