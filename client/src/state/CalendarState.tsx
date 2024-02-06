import { atom, selector, selectorFamily } from 'recoil'
import { userState } from './UserState'

import Calendar from '@/models/Calendar'

type CalendarData = {
  loading: boolean
  calendarsById: Record<string, Calendar>
}

export const calendarsState = atom({
  key: 'calendars-state',
  default: {
    loading: true,
    calendarsById: {},
  } as CalendarData,
})

/**
 * Gets the primary calendar, which is the default calendar chosen
 * to create a new event.
 *
 * If the default value is not set as a setting, it will use the primary
 * calendar (set by google) in the default account.
 */
export const primaryCalendarSelector = selector<Calendar | null>({
  key: 'calendars-primary',
  get: ({ get }) => {
    const calendarsById = get(calendarsState).calendarsById
    if (!calendarsById) {
      return null
    }

    const user = get(userState)
    if (!user) {
      return null
    }

    if (user.defaultCalendarId) {
      return calendarsById[user.defaultCalendarId]
    }

    const defaultAccount = user.accounts.find((account) => account.isDefault)!
    const defaultCalendar = Object.keys(calendarsById).find((key) => {
      const cal = calendarsById[key]
      return cal.primary == true && cal.account_id == defaultAccount.id
    })!

    if (defaultCalendar) {
      return calendarsById[defaultCalendar]
    } else {
      return null
    }
  },
})

export const calendarWithDefault = selectorFamily<Calendar, string>({
  key: 'calendars-default',
  get:
    (calendarId: string) =>
    ({ get }) => {
      const calendarsById = get(calendarsState).calendarsById
      const primaryCalendar = get(primaryCalendarSelector)

      if (calendarId) {
        return calendarsById[calendarId]
      } else {
        if (primaryCalendar) {
          return primaryCalendar
        } else {
          throw new Error('No primary calendar')
        }
      }
    },
})
