import { DateTime } from 'luxon'

const MONTHS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function monthsInYear(year: number): number[] {
  return MONTHS.map((month) => DateTime.local(year, month).month)
}

export function firstVisibleDay(date: DateTime, startOfWeek: number): DateTime {
  const startOfMonth = date.startOf('month')

  // Start of the week for the start of the month, which defaults to Monday
  const weekBefore = startOfMonth.startOf('week')

  // Since Luxon considers Monday as the start of the week, moving to the previous day
  // gives us Sunday of the previous week, which is the target day.
  return weekBefore.minus({ days: 1 }).plus({ days: startOfWeek % 7 })
}

export function lastVisibleDay(date: DateTime, startOfWeek: number): DateTime {
  const endOfMonth = date.endOf('month')
  const startOfNextMonth = endOfMonth.plus({ days: 1 })

  // Find the end of that week, which is Sunday by default in Luxon
  const endOfThatWeek = startOfNextMonth.endOf('week')

  // Subtract a day to adjust to Saturday, the actual end of your week
  return endOfThatWeek.minus({ days: 1 }).plus({ days: startOfWeek % 7 })
}

export function visibleDays(
  date: DateTime,
  startOfWeek: number,
  fillDates: boolean = false
): DateTime[] {
  let current = firstVisibleDay(date, startOfWeek)
  let last = lastVisibleDay(date, startOfWeek)
  let days: DateTime[] = []

  while (current <= last) {
    days.push(current)
    current = current.plus({ days: 1 })
  }

  if (fillDates) {
    while (days.length < 6 * 7) {
      days.push(current)
      current = current.plus({ days: 1 })
    }
  }

  return days
}

export function range(start: DateTime, end: DateTime, unit: keyof DateTime = 'day'): DateTime[] {
  let current = start
  let days: DateTime[] = []

  while (current <= end) {
    days.push(current)
    current = current.plus({ [unit]: 1 })
  }

  return days
}

export function merge(date: DateTime, time: DateTime): DateTime {
  return date.set({
    hour: time.hour,
    minute: time.minute,
    second: time.second,
    millisecond: time.millisecond,
  })
}

export function diff(dateA: DateTime, dateB: DateTime, unit: string = 'milliseconds'): number {
  return Math.abs(dateA.diff(dateB, unit as keyof DateTime).as(unit))
}

/**
 * Round to the nearest minute.
 */
export function round(date: DateTime): DateTime {
  // Check if seconds are 30 or more for rounding up
  if (date.second >= 30) {
    // Add one minute, then set seconds and milliseconds to 0
    return date.plus({ minutes: 1 }).startOf('minute')
  } else {
    // Just set seconds and milliseconds to 0 if not rounding up
    return date.startOf('minute')
  }
}
