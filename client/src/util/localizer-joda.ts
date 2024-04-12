import {
  ZonedDateTime,
  DayOfWeek,
  ChronoUnit,
  DateTimeFormatter,
  LocalDate,
  ZoneId,
  Instant,
} from '@js-joda/core'

import * as dates from '@/util/dates-joda'
import { Locale } from '@js-joda/locale_en-us'

export function firstDayOfWeek(): number {
  return 0
}

export function formatTimeShort(date: ZonedDateTime, space: boolean = false): string {
  const hour = date.hour()
  const minutes = date.minute()
  const meridian = date.hour() < 12 ? 'am' : 'pm'

  if (minutes === 0) {
    return `${hour}${space ? ' ' : ''}${meridian}`
  } else {
    return `${hour}:${minutes < 10 ? '0' : ''}${minutes}${space ? ' ' : ''}${meridian}`
  }
}

export function formatTimeRange(start: ZonedDateTime, end: ZonedDateTime): string {
  return `${formatTimeShort(start)} – ${formatTimeShort(end)}`
}

export function formatDateTime(value: ZonedDateTime): string {
  return value.format(DateTimeFormatter.ISO_INSTANT)
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

export function formatMonthTitle(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('MMMM yyyy').withLocale(Locale.US))
}

export function formatWeekRange(start: ZonedDateTime, end: ZonedDateTime): string {
  const sameMonth = start.month() === end.month()
  return `${start.format(
    DateTimeFormatter.ofPattern('MMMM dd').withLocale(Locale.US)
  )} – ${end.format(
    DateTimeFormatter.ofPattern(sameMonth ? 'dd' : 'MMMM dd').withLocale(Locale.US)
  )}`
}

export function formatFullDay(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('yyyy-MM-dd').withLocale(Locale.US))
}

export function formatLocaleDateString(date: ZonedDateTime): string {
  // This would require specifying a pattern or using predefined formats.
  return date.format(DateTimeFormatter.ofPattern('EEEE, MMMM d, yyyy').withLocale(Locale.US))
}

export function formatTwoLetterWeekday(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('EE').withLocale(Locale.US)).substring(0, 2)
}

export function formatDayOfMonth(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('d').withLocale(Locale.US))
}

export function formatThreeLetterWeekday(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('ccc').withLocale(Locale.US))
}

export function formatTwoDigitDay(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('dd').withLocale(Locale.US))
}

export function formatTwelveHourTime(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('hh:mm').withLocale(Locale.US))
}

export function formatAmPm(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('a').withLocale(Locale.US))
}

export function formatFullDate(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('cccc, LLLL dd').withLocale(Locale.US))
}

export function formatTimeHmma(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('h:mm a').withLocale(Locale.US))
}

export function formatDayOfWeekNumeric(date: ZonedDateTime): number {
  const dayOfWeek = date.dayOfWeek().value()
  return dayOfWeek === 7 ? 0 : dayOfWeek
}

export function formatTime24Hour(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('HH:mm').withLocale(Locale.US))
}

export function formatMonthDay(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('LLLL d').withLocale(Locale.US))
}

export function formatDayMonthYearWeekday(date: ZonedDateTime): string {
  return date.format(DateTimeFormatter.ofPattern('d LLL yyyy, ccc').withLocale(Locale.US))
}

export function roundNext15Min(date: ZonedDateTime): ZonedDateTime {
  const minuteOfHour = date.minute()
  const minutesToAdd = 15 - (minuteOfHour % 15)
  return date.plusMinutes(minutesToAdd).truncatedTo(ChronoUnit.MINUTES)
}

/**
 * Parses date in the format 'yyyy-MM-dd' to a ZonedDateTime.
 */
export function yearStringToDate(value: string): ZonedDateTime {
  return LocalDate.parse(value).atStartOfDay().atZone(ZoneId.systemDefault())
}

/**
 * Converts from the UTC date string to a ZonedDateTime.
 * The date string should be in the format 'yyyy-MM-ddTHH:mm:ssZ'.
 */
export function localFullDate(dateStr: string): ZonedDateTime {
  return ZonedDateTime.parse(dateStr)
}

export function getWeekRange(date: ZonedDateTime): ZonedDateTime[] {
  let start = dates.startOfWeek(date, firstDayOfWeek())
  let end = dates.endOfWeek(date, firstDayOfWeek())

  let days: ZonedDateTime[] = []
  let currentDate = start
  while (currentDate.compareTo(end) <= 0) {
    days.push(currentDate)
    currentDate = currentDate.plus(1, ChronoUnit.DAYS)
  }

  return days
}

export function isWeekend(date: ZonedDateTime): boolean {
  let dayOfWeek = date.dayOfWeek().value()
  return dayOfWeek === DayOfWeek.SATURDAY.value() || dayOfWeek === DayOfWeek.SUNDAY.value()
}

export function getWorkWeekRange(date: ZonedDateTime): ZonedDateTime[] {
  return getWeekRange(date).filter((d) => !isWeekend(d))
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

export function toJsDate(date: ZonedDateTime): Date {
  return new Date(date.toInstant().toEpochMilli())
}

export function fromJsDate(jsDate: Date, zone: ZoneId = ZoneId.systemDefault()): ZonedDateTime {
  // Convert the JavaScript Date to the number of milliseconds since the Unix epoch
  const epochMilli = jsDate.getTime()

  // Create an Instant from the epoch milliseconds
  const instant = Instant.ofEpochMilli(epochMilli)

  // Create a ZonedDateTime from the Instant in the specified zone
  return ZonedDateTime.ofInstant(instant, zone)
}
