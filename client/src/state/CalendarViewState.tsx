import { atom, selector } from 'recoil'
import { ZonedDateTime as DateTime, ZoneId } from '@js-joda/core'

import User from '@/models/User'
import { userState } from './UserState'

export type DisplayView = 'Day' | 'Week' | 'WorkWeek' | 'Month'

/**
 * Stores the current view of the calendar.
 *
 * Includes:
 * - current view, I.e. Day, Week, Month
 * - the selected date to view
 * - current time.
 *
 * Use a fixed-time offset for the selected date & current time.
 *
 */
export const calendarViewState = atom({
  key: 'ui-state',
  default: {
    view: 'Week' as DisplayView,
    selectedDate: DateTime.now(),
    now: DateTime.now(),
  },
  dangerouslyAllowMutability: true,
})

/**
 * Selector that returns the current display state of the calendar.
 * This includes the current view and current datetime in the local timezone.
 */
export const calendarViewStateUserTimezone = selector({
  key: 'display-state',
  get: ({ get }) => {
    const user = get(userState)
    const calendarView = get(calendarViewState)
    const timezone = User.getPrimaryTimezone(user)

    return {
      selectedDate: calendarView.selectedDate.withZoneSameInstant(ZoneId.of(timezone)),
      now: calendarView.now.withZoneSameInstant(ZoneId.of(timezone)),
    }
  },
  dangerouslyAllowMutability: true,
})
