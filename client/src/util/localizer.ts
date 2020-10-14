import * as dates from './dates'
import moment from 'moment'

/**
 * TODO: Replace moment with luxon.
 */

export function timeFormatShort(date: Date, space: boolean = false) {
  const m = moment(date)
  const hour = m.format('h')
  const minutes = date.getMinutes()
  const meridian = m.format('A').toLowerCase()

  if (minutes === 0) {
    return `${hour}${space ? ' ' : ''}${meridian}`
  } else {
    return `${hour}:${minutes}${space ? ' ' : ''}${meridian}`
  }
}

export function monthTitleFormat(date: Date): string {
  return moment(date).format('MMMM YYYY')
}

export function weekRangeFormat(start: Date, end: Date) {
  return (
    moment(start).format('MMMM DD') +
    ' – ' +
    moment(end).format(dates.eq(start, end, 'month') ? 'DD' : 'MMMM DD')
  )
}

export function timeRangeFormat(start: Date, end: Date) {
  return timeFormatShort(start) + ' – ' + timeFormatShort(end)
}

export function dayFormat(date: Date) {
  return moment(date).format('dd DD')
}

export function startOfWeek() {
  let data = moment.localeData()
  return data ? data.firstDayOfWeek() : 0
}

export function format(value: any, format: string) {
  return moment(value).format(format)
}

export function formatDateTime(value: any) {
  return moment(value).format()
}

export function getWorkWeekRange(date: Date) {
  return getWeekRange(date).filter((d) => !isWeekend(d))
}

export function getWeekRange(date: Date) {
  const firstOfWeek = startOfWeek()
  const start = dates.startOf(date, 'week', firstOfWeek)
  const end = dates.endOf(date, 'week', firstOfWeek)

  return dates.range(start, end)
}

export function getDurationDisplay(start: Date, end: Date): string {
  const milliseconds = end.getTime() - start.getTime()
  const minutes = milliseconds / 1000 / 60

  if (minutes < 60) {
    return `${minutes}m`
  } else {
    const hours = Math.floor(minutes / 60)
    const min = minutes % 60
    return min > 0 ? `${hours}h ${min}m` : `${hours}h`
  }
}

export function roundNext15Min(date: Date): Date {
  const m = moment(date)

  var intervals = Math.floor(m.minutes() / 15)
  if (m.minutes() % 15 != 0) {
    intervals++
  }
  if (intervals == 4) {
    m.add('hours', 1)
    intervals = 0
  }
  m.minutes(intervals * 15)
  m.seconds(0)

  return m.toDate()
}

function isWeekend(date: Date): boolean {
  const day = moment(date).day()
  return day === moment().day('Saturday').day() || day === moment().day('Sunday').day()
}
