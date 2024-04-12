import {
  LocalDate,
  ZonedDateTime,
  ZoneId,
  ChronoUnit,
  LocalTime,
  LocalDateTime,
} from '@js-joda/core'
import * as dates from './dates-joda'

function parseFullDay(date: string): ZonedDateTime {
  return LocalDate.parse(date).atStartOfDay().atZone(ZoneId.of('UTC'))
}

test('joda startOfWeek is sunday', () => {
  const startOfWeek = dates.startOfWeek(parseFullDay('2024-03-10'), 0)
  expect(startOfWeek).toEqual(parseFullDay('2024-03-10'))
})

test('joda endofweek', () => {
  // should be 2024-03-16
  const endOfWeekMonday = dates.endOfWeek(parseFullDay('2024-03-11'), 0)
  console.log(endOfWeekMonday.toString())
  expect(endOfWeekMonday).toEqual(parseFullDay('2024-03-16'))

  // should be 2024-03-16
  const endOfWeekSunday = dates.endOfWeek(parseFullDay('2024-03-10'), 0)
  expect(endOfWeekSunday).toEqual(parseFullDay('2024-03-16'))
  console.log(endOfWeekSunday.toString())
})

test('joda firstVisibleDay returns next month, start of last week', () => {
  const firstVisibleDay = dates.firstVisibleDay(parseFullDay('2024-03-10'), 0)
  console.log(firstVisibleDay.toString())

  expect(firstVisibleDay).toEqual(parseFullDay('2024-02-25'))
})

test('joda visibleDays should get dates for a month, including one week before & after', () => {
  const zoneId = ZoneId.of('UTC')
  const datePart = LocalDate.of(2024, 3, 10)
  const timePart = LocalTime.of(0, 0, 0) // Assuming you want to start at midnight
  const dateTimePart = LocalDateTime.of(datePart, timePart)
  const zonedDateTime = ZonedDateTime.of(dateTimePart, zoneId)

  const visibleDays = dates.visibleDays(zonedDateTime, 0)
  expect(visibleDays.length).toBe(42)
})

test('joda range should get range between two dates', () => {
  const range = dates.range(parseFullDay('2024-03-15'), parseFullDay('2024-03-20'))

  expect(range.length).toBe(6)
  expect(range[0].toLocalDate().toString()).toBe('2024-03-15')
  expect(range[5].toLocalDate().toString()).toBe('2024-03-20')
})

test("merge should merge the first with the second's time", () => {
  const date = parseFullDay('2024-03-15')
  const time = ZonedDateTime.of(LocalDate.of(2024, 3, 15), LocalTime.of(12, 5), ZoneId.of('UTC'))

  const merge = dates.merge(date, time)

  expect(merge.toString()).toBe('2024-03-15T12:05Z[UTC]')
})

test('diff returns rounded date', () => {
  const dateStringStart = '2024-03-16T00:00:00Z'
  const dateStringEnd = '2024-03-16T14:15:00Z'

  const diff = dates.diff(
    ZonedDateTime.parse(dateStringStart),
    ZonedDateTime.parse(dateStringEnd),
    ChronoUnit.HOURS
  )

  expect(diff).toBe(14)
})
