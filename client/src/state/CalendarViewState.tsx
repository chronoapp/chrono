import { atom, selector } from 'recoil'
import { DateTime } from 'luxon'

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
 */
export const calendarViewState = atom({
  key: 'ui-state',
  default: {
    view: 'Week' as DisplayView,
    selectedDate: DateTime.now(),
    now: DateTime.now(),
  },
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
      selectedDate: calendarView.selectedDate.setZone(timezone) as DateTime,
      now: calendarView.now.setZone(timezone),
    }
  },
})
