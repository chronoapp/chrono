import * as dates from './dates'
import moment from 'moment'

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

export function getWeekRange(date: Date) {
  const firstOfWeek = startOfWeek()
  const start = dates.startOf(date, 'week', firstOfWeek)
  const end = dates.endOf(date, 'week', firstOfWeek)

  return dates.range(start, end)
}
