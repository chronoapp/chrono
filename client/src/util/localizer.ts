import * as dates from './dates'
import moment from 'moment'

export const weekRangeFormat = (start: Date, end: Date) =>
  moment(start).format('MMMM DD') +
  ' – ' +
  moment(end).format(dates.eq(start, end, 'month') ? 'DD' : 'MMMM DD')

export const timeRangeFormat = (start: Date, end: Date) =>
  moment(start).format('LT') + ' – ' + moment(end).format('LT')

export const dayFormat = (date: Date) => moment(date).format('dd DD')

export function startOfWeek() {
  let data = moment.localeData()
  return data ? data.firstDayOfWeek() : 0
}

export function format(value: any, format: string) {
  return moment(value).format(format)
}
