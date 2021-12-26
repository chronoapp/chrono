import moment from 'moment-timezone'

import { getStartTimeOptions, getEndTimeOptions } from './TimeSelect'
import * as dates from '../../util/dates'

// DST transitions at 2:00 AM
test('getStartTimeOptions', () => {
  const start = moment.tz('2021-03-14 00:30:00', 'America/Toronto').toDate() // gmt-5
  const end = moment.tz('2021-03-14 04:00:00', 'America/Toronto').toDate() // gmt-4 @ 3am

  const dayStart: Date = dates.startOf(start, 'day')
  const options = getStartTimeOptions(dayStart, end)

  expect(options[0].label).toBe('12:00 AM')
  expect(options[options.length - 1].label).toBe('3:45 AM')
})

test('getEndTimeOptions dst before transition', () => {
  const start = moment.tz('2021-03-14 01:30:00', 'America/Toronto').toDate()
  const end = moment.tz('2021-03-14 03:00:00', 'America/Toronto').toDate() // gmt-4 @ 3am

  const dayEnd: Date = dates.endOf(end, 'day')
  const options = getEndTimeOptions(start, dayEnd)

  expect(options[0].label).toBe('1:45 AM')
  expect(options[options.length - 1].label).toBe('12:00 AM')
})

test('getEndTimeOptions dst after transition', () => {
  const start = moment.tz('2021-03-14 04:30:00', 'America/Toronto').toDate()
  const end = moment.tz('2021-03-14 05:00:00', 'America/Toronto').toDate() // gmt-4 @ 3am

  const dayEnd: Date = dates.endOf(end, 'day')
  const options = getEndTimeOptions(start, dayEnd)

  expect(options[0].label).toBe('4:45 AM')
  expect(options[options.length - 1].label).toBe('12:00 AM')
})
