import { DateTime } from 'luxon'

/**
 * Wrapper for date localization.
 */
export function timeFormatShort(date: DateTime, space: boolean = false): string {
  const hour = date.toFormat('h')
  const minutes = date.minute
  const meridian = date.toFormat('a').toLowerCase()

  if (minutes === 0) {
    return `${hour}${space ? ' ' : ''}${meridian}`
  } else {
    return `${hour}:${minutes < 10 ? '0' : ''}${minutes}${space ? ' ' : ''}${meridian}`
  }
}

export function timeRangeFormat(start: DateTime, end: DateTime): string {
  return `${timeFormatShort(start)} – ${timeFormatShort(end)}`
}

/**
 * Two letter day followed by day of month.
 * E.g. Su 02
 */
export function dayFormat(date: DateTime): string {
  const dayOfMonth = date.toFormat('dd')

  return `${formatTwoLetterWeekday(date)} ${dayOfMonth}`
}

export function startOfWeek(): number {
  // This will depend on the locale; for ISO standard, it's 1 (Monday)
  // For US locale, Sunday (0) is often considered the start of the week
  // TODO: Make this into a config.

  return 0
}

export function formatDateTime(value: DateTime): string {
  return value.toISO()
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

export function monthTitleFormat(date: DateTime): string {
  return date.toFormat('MMMM yyyy')
}

export function weekRangeFormat(start: DateTime, end: DateTime): string {
  const sameMonth = start.month === end.month
  return `${start.toFormat('MMMM dd')} – ${end.toFormat(sameMonth ? 'dd' : 'MMMM dd')}`
}

export function fullDayFormat(date: DateTime): string {
  return date.toFormat('yyyy-MM-dd')
}

export function formatLocaleDateString(date: DateTime): string {
  return date.toFormat('DD')
}

export function formatTwoLetterWeekday(date: DateTime): string {
  const dayAbbreviation = date.toFormat('ccc')
  const dayTwoLetter = dayAbbreviation.slice(0, 2)

  return dayTwoLetter
}

export function formatDayOfMonth(date: DateTime): string {
  return date.toFormat('d')
}

export function formatThreeLetterWeekday(date: DateTime): string {
  return date.toFormat('ccc')
}

export function formatTwoDigitDay(date: DateTime): string {
  return date.toFormat('dd')
}

export function formatTwelveHourTime(date: DateTime): string {
  return date.toFormat('hh:mm')
}

export function formatAmPm(date: DateTime): string {
  return date.toFormat('a')
}

export function formatFullDate(date: DateTime): string {
  return date.toFormat('cccc, LLLL dd')
}

export function formatTimeHmma(date: DateTime): string {
  return date.toFormat('h:mm a')
}

export function formatDayOfWeekNumeric(date: DateTime) {
  const dayOfWeek = date.weekday

  return date.weekday == 7 ? 0 : dayOfWeek
}

export function formatTime24Hour(date: DateTime) {
  return date.toFormat('HH:mm')
}

export function formatMonthDay(date: DateTime) {
  return date.toFormat('LLLL d')
}

/**
 * E.g. 17 Mar 2025, Mon
 */
export function formatDayMonthYearWeekday(date: DateTime) {
  return date.toFormat('d LLL yyyy, ccc')
}

export function roundNext15Min(date: DateTime): DateTime {
  let rounded = date.plus({ minutes: 15 - (date.minute % 15) })
  return rounded.set({ seconds: 0 })
}

export function localFullDate(dateStr: string): DateTime {
  return DateTime.fromISO(dateStr)
}

export function getWorkWeekRange(date: DateTime) {
  return getWeekRange(date).filter((d) => !isWeekend(d))
}

export function getWeekRange(date: DateTime) {
  let start = date.startOf('week')
  let end = date.endOf('week')
  let days: DateTime[] = []
  while (start <= end) {
    days.push(start)
    start = start.plus({ days: 1 })
  }
  return days
}

export function getDurationDisplay(start: DateTime, end: DateTime): string {
  const duration = end.diff(start, ['hours', 'minutes']).toObject()
  if (duration.hours === 0 && duration.minutes < 60) {
    return `${duration.minutes}m`
  } else {
    return `${duration.hours}h ${duration.minutes > 0 ? `${duration.minutes}m` : ''}`.trim()
  }
}

function isWeekend(date: DateTime): boolean {
  return date.weekday === 6 || date.weekday === 7
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
