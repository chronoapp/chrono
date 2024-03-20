import * as dates from 'date-arithmetic'

export {
  milliseconds,
  seconds,
  minutes,
  hours,
  month,
  startOf,
  endOf,
  add,
  subtract,
  eq,
  gte,
  gt,
  lte,
  lt,
  inRange,
  min,
  max,
} from 'date-arithmetic'

/**
 * Thin wrapper around date arithmetic https://www.npmjs.com/package/date-arithmetic
 */

export const MILLI = {
  seconds: 1000,
  minutes: 1000 * 60,
  hours: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
}

const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export function monthsInYear(year) {
  let date = new Date(year, 0, 1)

  return MONTHS.map((i) => dates.month(date, i))
}

export function firstVisibleDay(date: Date, startOfWeek: number) {
  let firstOfMonth = dates.startOf(date, 'month')

  return dates.startOf(firstOfMonth, 'week', startOfWeek)
}

export function lastVisibleDay(date: Date, startOfWeek: number) {
  let endOfMonth = dates.endOf(date, 'month')

  return dates.endOf(endOfMonth, 'week', startOfWeek)
}

export function visibleDays(date: Date, startOfWeek: number, fillDates: boolean = false) {
  let current = firstVisibleDay(date, startOfWeek),
    last = lastVisibleDay(date, startOfWeek)

  const days: Date[] = []

  while (dates.lte(current, last, 'day')) {
    days.push(current)
    current = dates.add(current, 1, 'day')
  }

  if (fillDates) {
    while (days.length < 6 * 7) {
      days.push(current)
      current = dates.add(current, 1, 'day')
    }
  }

  return days
}

export function range(start: Date, end: Date, unit = 'day') {
  let current = start
  const days: Date[] = []

  while (dates.lte(current, end, unit)) {
    days.push(current)
    current = dates.add(current, 1, unit)
  }

  return days
}

/**
 * Sets the LHS date to the hours / minutes / seconds / milliseconds
 * of the RHS time. Used for generating timerange within a day.
 */
export function merge(date, time) {
  if (time == null && date == null) return null

  if (time == null) time = new Date()
  if (date == null) date = new Date()

  date = dates.startOf(date, 'day')
  date = dates.hours(date, dates.hours(time))
  date = dates.minutes(date, dates.minutes(time))
  date = dates.seconds(date, dates.seconds(time))
  return dates.milliseconds(date, dates.milliseconds(time))
}

export function diff(dateA: Date, dateB: Date, unit = 'milliseconds') {
  if (unit === 'milliseconds') return Math.abs(+dateA - +dateB)

  // the .round() handles an edge case
  // with DST where the total won't be exact
  // since one day in the range may be shorter/longer by an hour
  return Math.round(
    Math.abs(+dates.startOf(dateA, unit) / MILLI[unit] - +dates.startOf(dateB, unit) / MILLI[unit])
  )
}

export function round(date: Date) {
  return new Date(Math.round(date.getTime() / 60000) * 60000)
}
