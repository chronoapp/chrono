import React from 'react'
import chunk from 'lodash/chunk'

import Event from '../models/Event'
import * as dates from '../util/dates'
import { startOfWeek } from '../util/localizer'
import { inRange, sortEvents } from './utils/eventLevels'
import WeekRow from './WeekRow'

interface IProps {
  events: Event[]
  date: Date
}

function Month(props: IProps) {
  console.log(startOfWeek())
  const month = dates.visibleDays(props.date, startOfWeek())
  const weeks = chunk(month, 7)

  function renderWeek(week: Date[], weekIdx: number) {
    const eventsForWeek = props.events.filter((e) => inRange(e, week[0], week[week.length - 1]))
    eventsForWeek.sort((a, b) => sortEvents(a, b))

    return <WeekRow range={week} date={props.date} key={weekIdx} events={eventsForWeek} />
  }

  return (
    <div className="cal-month-view">
      <div className="cal-month-header"></div>
      {weeks.map(renderWeek)}
    </div>
  )
}

export default Month
