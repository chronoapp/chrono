import { DateTime } from 'luxon'
import * as datesLuxon from './dates-luxon'

test('startOfWeek is sunday', () => {
  const startOfWeek = datesLuxon.startOfWeek(DateTime.fromISO('2024-03-10'), 0)
  expect(startOfWeek).toEqual(DateTime.fromISO('2024-03-10'))
})

test('endOfWeek is saturday', () => {
  // ensure that endOfWeek(Monday) is the end of Saturday
  const endOfWeekMonday = datesLuxon.endOfWeek(DateTime.fromISO('2024-03-11'), 0)
  expect(endOfWeekMonday).toEqual(DateTime.fromISO('2024-03-16').endOf('day'))

  // ensure that endOfWeek(Sunday) is the end of Saturday
  const endOfWeekSunday = datesLuxon.endOfWeek(DateTime.fromISO('2024-03-10'), 0)
  expect(endOfWeekSunday).toEqual(DateTime.fromISO('2024-03-16').endOf('day'))
})

test('firstVisibleDay returns next month, start of last week', () => {
  const firstVisibleDay = datesLuxon.firstVisibleDay(DateTime.fromISO('2024-03-10'), 0)
  expect(firstVisibleDay).toEqual(DateTime.fromISO('2024-02-25'))
})

test('visibleDays should get dates for a month, including one week before & after', () => {
  const visibleDaysLuxon = datesLuxon.visibleDays(DateTime.fromISO('2024-03-10'), 0)
  expect(visibleDaysLuxon.length).toBe(42)
})

test('range should get range between two dates', () => {
  const range = datesLuxon.range(DateTime.fromISO('2024-03-15'), DateTime.fromISO('2024-03-20'))

  expect(range.length).toBe(6)
  expect(range[0].toISODate()).toBe('2024-03-15')
  expect(range[5].toISODate()).toBe('2024-03-20')
})

test("merge should merge the first with the second's time", () => {
  const merge = datesLuxon.merge(
    DateTime.fromISO('2024-03-15').setZone('America/New_York'),
    DateTime.fromISO('2024-03-15T12:05:00').setZone('America/New_York')
  )

  expect(merge.toISO()).toBe('2024-03-15T12:05:00.000-04:00')
})

test('diff returns rounded date', () => {
  const dateStringStart = '2024-03-16T00:00:00.000Z'
  const dateString = '2024-03-16T14:15:00.000Z'

  const diff = datesLuxon.diff(
    DateTime.fromISO(dateStringStart),
    DateTime.fromISO(dateString),
    'hours'
  )

  expect(diff).toBe(14)
})
