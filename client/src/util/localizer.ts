import * as dates from './dates'
import moment from 'moment'

/**
 * Wrapper for date localization.
 * TODO: Replace moment with date-fns / luxon.
 */

export function startOfWeek() {
  let data = moment.localeData()
  return data ? data.firstDayOfWeek() : 0
}

export function formatTimeShort(date: Date, space: boolean = false) {
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

export function formatTimeRange(start: Date, end: Date) {
  return formatTimeShort(start) + ' – ' + formatTimeShort(end)
}

export function formatDateTime(value: any) {
  return moment(value).format()
}

export function formatDuration(durationInMinutes: number) {
  if (durationInMinutes < 60) {
    return `${durationInMinutes}m`
  }

  const hours = Math.floor(durationInMinutes / 60)
  const minutes = durationInMinutes % 60

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

export function formatMonthTitle(date: Date): string {
  return moment(date).format('MMMM YYYY')
}

export function formatWeekRange(start: Date, end: Date) {
  return (
    moment(start).format('MMMM DD') +
    ' – ' +
    moment(end).format(dates.eq(start, end, 'month') ? 'DD' : 'MMMM DD')
  )
}

/**
 * Date into a full day string (YYYY-MM-DD)
 */
export function formatFullDay(date: Date) {
  return moment(date).format(moment.HTML5_FMT.DATE)
}

export function formatLocaleDateString(date: Date) {
  return moment(date).format('LL')
}

export function formatTwoLetterWeekday(date: Date) {
  return moment(date).format('dd')
}

export function formatDayOfMonth(date: Date) {
  return moment(date).format('D')
}

export function formatThreeLetterWeekday(date: Date) {
  return moment(date).format('ddd')
}

export function formatTwoDigitDay(date: Date) {
  return moment(date).format('DD')
}

export function formatAmPm(date: Date) {
  return moment(date).format('A')
}

/**
 * includes the full day name, full month name, and day in two digits.
 * Eg. "Sunday, January 01".
 */
export function formatFullDate(date: Date) {
  return moment(date).format('dddd, MMMM DD')
}

export function formatTimeHmma(date: Date) {
  return moment(date).format('h:mm A')
}

export function formatDayOfWeekNumeric(date: Date) {
  return moment(date).format('d')
}

export function formatTime24Hour(date: Date) {
  return moment(date).format('HH:mm')
}

export function formatMonthDay(date: Date) {
  return moment(date).format('MMMM D')
}

/**
 * E.g. 17 Mar 2025, Mon
 */
export function formatDayMonthYearWeekday(date: Date) {
  return moment(date).format('D MMM YYYY, ddd')
}

/**
 * Converts a date string (YYYY-MM-DD) into a Date object.
 */
export function yearStringToDate(value: string): Date {
  return moment(value, 'YYYY-MM-DD').toDate()
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

export function localFullDate(dateStr: string): Date {
  return moment(dateStr).toDate()
}

function isWeekend(date: Date): boolean {
  const day = moment(date).day()
  return day === moment().day('Saturday').day() || day === moment().day('Sunday').day()
}

export function formatTimeAgo(seconds: number) {
  if (seconds < 60) {
    return '<1 minute'
  }

  // Days, hours, minutes
  const fm = [
    Math.floor(seconds / (3600 * 24)),
    Math.floor((seconds % (3600 * 24)) / 3600),
    Math.floor((seconds % 3600) / 60),
  ]

  const units = ['day', 'hour', 'minute']

  // Find the first non-zero unit
  for (let i = 0; i < fm.length; i++) {
    if (fm[i] > 0) {
      return plural(fm[i], units[i])
    }
  }

  return 'just now'
}

function plural(value, unit: string) {
  const unitStr = value === 1 ? unit : `${unit}s`
  return `${value} ${unitStr}`
}
