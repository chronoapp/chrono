import { DateTime } from 'luxon'
import chunk from '@/lib/js-lib/chunk'

import * as dates from '@/util/dates-luxon'
import { firstDayOfWeek, formatMonthTitle } from '@/util/localizer-luxon'

import Event from '@/models/Event'
import Calendar from '@/models/Calendar'

import { inRange, sortEvents } from './utils/eventLevels'
import WeekRow from './WeekRow'
import { EventService } from './event-edit/useEventService'

interface IProps {
  events: Event[]
  loading: boolean
  date: DateTime
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
}

function Month(props: IProps) {
  const month = dates.visibleDays(props.date, firstDayOfWeek())
  const weeks = chunk(month, 7)

  function renderWeek(week: DateTime[], weekIdx: number) {
    const eventsForWeek = props.events.filter((e) => inRange(e, week[0], week[week.length - 1]))
    eventsForWeek.sort((a, b) => sortEvents(a, b))

    return (
      <WeekRow
        loading={props.loading}
        range={week}
        today={props.now}
        date={props.date}
        key={weekIdx}
        events={eventsForWeek}
        showDatesOfWeek={weekIdx == 0}
        eventService={props.eventService}
        primaryCalendar={props.primaryCalendar}
      />
    )
  }

  return <div className="cal-month-view">{weeks.map(renderWeek)}</div>
}

Month.getTitle = formatMonthTitle

export default Month
