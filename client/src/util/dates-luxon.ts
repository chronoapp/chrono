import { DateTime, DateTimeUnit, DurationUnit } from 'luxon'

export const MILLI = {
  seconds: 1000,
  minutes: 1000 * 60,
  hours: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
}

const MONTHS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function monthsInYear(year: number): number[] {
  return MONTHS.map((month) => DateTime.local(year, month).month)
}

/**
 * Start of week, assuming that the week starts on Sunday.
 */
export function startOfWeek(date: DateTime, firstOfWeek: number) {
  // hack for `weekData is read-only` when using recoil
  const weekDay = date.plus(0).weekday
  if (weekDay == 7) {
    return date.startOf('day').plus({ days: firstOfWeek % 7 })
  } else {
    return date
      .startOf('week')
      .minus({ days: 1 }) // Sunday
      .plus({ days: firstOfWeek % 7 })
  }
}

/**
 * End of week, assuming that the week starts on Sunday (ends on Saturday).
 */
export function endOfWeek(date: DateTime, firstOfWeek: number) {
  // Calculate the start of the week as Sunday, then add 6 days to get to Saturday.
  const weekStart = startOfWeek(date, firstOfWeek)
  return weekStart
    .plus({ days: 6 })
    .endOf('day')
    .plus({ days: firstOfWeek % 7 })
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

export function diff(
  dateA: DateTime,
  dateB: DateTime,
  unit: DurationUnit = 'milliseconds'
): number {
  const difference = dateA.diff(dateB, unit).as(unit)

  return Math.floor(Math.abs(difference))
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

export function gt(date1: DateTime, date2: DateTime, unit: DateTimeUnit = 'minute'): boolean {
  // Adjust both dates to the start of the specified unit before comparing
  const adjustedDate1 = date1.startOf(unit)
  const adjustedDate2 = date2.startOf(unit)

  return adjustedDate1 > adjustedDate2
}

export function lt(date1: DateTime, date2: DateTime, unit: DateTimeUnit = 'minute'): boolean {
  // Adjust both dates to the start of the specified unit before comparing
  const adjustedDate1 = date1.startOf(unit)
  const adjustedDate2 = date2.startOf(unit)

  return adjustedDate1 < adjustedDate2
}

export function gte(date1: DateTime, date2: DateTime, unit: DateTimeUnit = 'minute'): boolean {
  // Adjust both dates to the start of the specified unit before comparing
  const adjustedDate1 = date1.startOf(unit)
  const adjustedDate2 = date2.startOf(unit)

  return adjustedDate1 >= adjustedDate2
}

export function lte(date1: DateTime, date2: DateTime, unit: DateTimeUnit = 'minute'): boolean {
  // Adjust both dates to the start of the specified unit before comparing
  const adjustedDate1 = date1.startOf(unit)
  const adjustedDate2 = date2.startOf(unit)

  return adjustedDate1 <= adjustedDate2
}

export function inRange(
  date: DateTime,
  start: DateTime,
  end: DateTime,
  unit: DateTimeUnit = 'minute'
): boolean {
  // Normalize dates to the start of the specified unit
  const normalizedDate = date.startOf(unit)
  const normalizedStart = start.startOf(unit)
  const normalizedEnd = end.startOf(unit)

  // Compare the normalized dates
  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd
}

export function max(date1: DateTime, date2: DateTime): DateTime {
  return date1 > date2 ? date1 : date2
}

export function min(date1: DateTime, date2: DateTime): DateTime {
  return date1 < date2 ? date1 : date2
}

export function eq(date1: DateTime, date2: DateTime, unit: DateTimeUnit = 'minute'): boolean {
  return date1.hasSame(date2, unit)
}

export function startOf(date: DateTime, unit: DateTimeUnit) {
  return date.startOf(unit)
}

export function endOf(date: DateTime, unit: DateTimeUnit) {
  return date.endOf(unit)
}

export function add(date: DateTime, value: number, unit: DateTimeUnit) {
  return date.plus({ [unit]: value })
}

export function subtract(date: DateTime, value: number, unit: DateTimeUnit) {
  return date.minus({ [unit]: value })
}

export function hasSame(date1: DateTime, date2: DateTime, unit: DateTimeUnit): boolean {
  return date1.hasSame(date2, unit)
}

export function setToStartOfDayWithMinutes(date: DateTime, minutes: number): DateTime {
  return date.set({ hour: 0, minute: minutes, second: 0, millisecond: 0 })
}
