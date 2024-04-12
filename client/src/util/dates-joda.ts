import { ZonedDateTime, ChronoUnit, ChronoField } from '@js-joda/core'
import '@js-joda/timezone' // Import for DateTime support

export const MILLI = {
  seconds: 1000,
  minutes: 1000 * 60,
  hours: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
}

// Utility function to get the start of the week for a given DateTime
export function startOfWeek(date: ZonedDateTime, firstOfWeek: number = 0): ZonedDateTime {
  let dayOfWeek = date.dayOfWeek().value()
  dayOfWeek = dayOfWeek === 7 ? 0 : dayOfWeek // Adjust Sunday from 7 to 0
  const delta = (firstOfWeek - dayOfWeek - 7) % 7

  return date.plusDays(delta).truncatedTo(ChronoUnit.DAYS)
}

// Utility function to get the end of the week for a given DateTime
export function endOfWeek(date: ZonedDateTime, firstOfWeek: number = 0): ZonedDateTime {
  return startOfWeek(date, firstOfWeek).plusDays(6).truncatedTo(ChronoUnit.DAYS)
}

export function firstVisibleDay(date: ZonedDateTime, firstOfWeek: number): ZonedDateTime {
  const startOfMonth = date.withDayOfMonth(1)
  return startOfWeek(startOfMonth, firstOfWeek)
}

export function lastVisibleDay(date: ZonedDateTime, firstOfWeek: number): ZonedDateTime {
  const endOfMonth = date.withDayOfMonth(date.month().length(false))
  return endOfWeek(endOfMonth, firstOfWeek)
}

export function visibleDays(
  date: ZonedDateTime,
  startOfWeek: number,
  fillDates: boolean = false
): ZonedDateTime[] {
  let current = firstVisibleDay(date, startOfWeek)
  const last = lastVisibleDay(date, startOfWeek)
  let days: ZonedDateTime[] = []

  while (current.isBefore(last) || current.isEqual(last)) {
    days.push(current)
    current = current.plusDays(1)
  }

  if (fillDates) {
    while (days.length < 6 * 7) {
      // Fill to complete 6 weeks
      days.push(current)
      current = current.plusDays(1)
    }
  }

  return days
}

export function range(
  start: ZonedDateTime,
  end: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.DAYS
): ZonedDateTime[] {
  let current = start
  let days: ZonedDateTime[] = []

  while (current.isBefore(end) || current.isEqual(end)) {
    days.push(current)
    current = current.plus(1, unit)
  }

  return days
}

// Merge date from one ZonedDateTime with time from another
export function merge(date: ZonedDateTime, time: ZonedDateTime): ZonedDateTime {
  const mergedDateTime = date
    .withHour(time.hour())
    .withMinute(time.minute())
    .withSecond(time.second())
    .withNano(time.nano())
  return mergedDateTime
}

export function diff(
  dateA: ZonedDateTime,
  dateB: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MILLIS
): number {
  return Math.abs(dateA.until(dateB, unit))
}

/**
 * Round to the nearest minute.
 */
export function round(date: ZonedDateTime): ZonedDateTime {
  // Check if seconds are 30 or more for rounding up
  if (date.second() >= 30) {
    // Add one minute, then truncate to start of that minute (removing seconds and nanoseconds)
    return date.plusMinutes(1).truncatedTo(ChronoUnit.MINUTES)
  } else {
    // Just truncate to start of the current minute if not rounding up
    return date.truncatedTo(ChronoUnit.MINUTES)
  }
}

// Check if date1 is greater than date2
export function gt(
  date1: ZonedDateTime,
  date2: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MINUTES
): boolean {
  return date1.truncatedTo(unit).isAfter(date2.truncatedTo(unit))
}

// Check if date1 is less than date2
export function lt(
  date1: ZonedDateTime,
  date2: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MINUTES
): boolean {
  return date1.truncatedTo(unit).isBefore(date2.truncatedTo(unit))
}

// Check if date1 is greater than or equal to date2
export function gte(
  date1: ZonedDateTime,
  date2: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MINUTES
): boolean {
  return !lt(date1, date2, unit)
}

// Check if date1 is less than or equal to date2
export function lte(
  date1: ZonedDateTime,
  date2: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MINUTES
): boolean {
  return !gt(date1, date2, unit)
}

// Check if date is within the range [start, end]
export function inRange(
  date: ZonedDateTime,
  start: ZonedDateTime,
  end: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MINUTES
): boolean {
  return (
    !date.truncatedTo(unit).isBefore(start.truncatedTo(unit)) &&
    !date.truncatedTo(unit).isAfter(end.truncatedTo(unit))
  )
}

// Get the maximum of two dates
export function max(date1: ZonedDateTime, date2: ZonedDateTime): ZonedDateTime {
  return date1.isAfter(date2) ? date1 : date2
}

// Get the minimum of two dates
export function min(date1: ZonedDateTime, date2: ZonedDateTime): ZonedDateTime {
  return date1.isBefore(date2) ? date1 : date2
}

// Check if two dates are equal based on the specified unit
export function eq(
  date1: ZonedDateTime,
  date2: ZonedDateTime,
  unit: ChronoUnit = ChronoUnit.MINUTES
): boolean {
  return date1.truncatedTo(unit).isEqual(date2.truncatedTo(unit))
}

// Start of a given unit
export function startOf(date: ZonedDateTime, unit: ChronoUnit): ZonedDateTime {
  return date.truncatedTo(unit)
}

// End of a given unit
export function endOf(date: ZonedDateTime, unit: ChronoUnit): ZonedDateTime {
  switch (unit) {
    case ChronoUnit.DAYS:
      return date.plusDays(1).truncatedTo(unit).minusNanos(1)
    case ChronoUnit.MONTHS:
      return date.plusMonths(1).withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS).minusNanos(1)
    // Add cases for other units as needed
    default:
      throw new Error(`Unit '${unit}' not supported for endOf operation.`)
  }
}

// Additional functions to add or subtract time
export function add(date: ZonedDateTime, value: number, unit: ChronoUnit): ZonedDateTime {
  return date.plus(value, unit)
}

export function subtract(date: ZonedDateTime, value: number, unit: ChronoUnit): ZonedDateTime {
  return date.minus(value, unit)
}

export function hasSame(date1: ZonedDateTime, date2: ZonedDateTime, unit: ChronoUnit): boolean {
  return date1.truncatedTo(unit).isEqual(date2.truncatedTo(unit))
}

/**
 * Sets the given ZonedDateTime to the start of the day with specified minutes,
 * and resets seconds and milliseconds to zero.
 *
 * @param {ZonedDateTime} dayStart - The original ZonedDateTime to adjust.
 * @param {number} minFromStart - The minutes from the start of the day to set.
 * @return {ZonedDateTime} - The adjusted ZonedDateTime.
 */
export function setToStartOfDayWithMinutes(
  dayStart: ZonedDateTime,
  minFromStart: number
): ZonedDateTime {
  return dayStart
    .withHour(0)
    .withMinute(minFromStart)
    .withSecond(0)
    .with(ChronoField.MILLI_OF_SECOND, 0)
}

export function toMillis(date: ZonedDateTime): number {
  return date.toInstant().toEpochMilli()
}
