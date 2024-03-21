import { DateTime } from 'luxon'
import * as localizer from './localizer-luxon'

test('timeFormatShort', () => {
  const timeFormatShort = localizer.formatTimeShort(
    DateTime.fromISO('2024-03-16T14:30:00.000Z', { zone: 'America/Toronto' })
  )

  expect(timeFormatShort).toBe('10:30am')
})

test('monthTitleFormat', () => {
  const monthTitleFormat = localizer.formatMonthTitle(DateTime.fromISO('2024-03-10'))

  expect(monthTitleFormat).toBe('March 2024')
})

test('formatFullDay', () => {
  const fullDay = localizer.formatFullDay(DateTime.fromISO('2024-03-10T12:00:00.000Z'))
  expect(fullDay).toBe('2024-03-10')
})

test('formatDayOfWeekNumeric', () => {
  // Saturday March 16, 2024
  const dayOfWeek = localizer.formatDayOfWeekNumeric(
    DateTime.fromISO('2024-03-16T12:00:00.000Z', { zone: 'America/Toronto' })
  )
  expect(dayOfWeek).toBe(6)
})

test('roundNext15Min', () => {
  const rounded = localizer.roundNext15Min(DateTime.fromISO('2024-03-12T14:48:10.000Z')).toUTC()

  expect(rounded.toISO()).toBe('2024-03-12T15:00:00.000Z')
})
