import { atom, selector, selectorFamily } from 'recoil'

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

export const primaryCalendarSelector = selector<Calendar | null>({
  key: 'calendars-primary',
  get: ({ get }) => {
    const calendarsById = get(calendarsState).calendarsById
    const k = Object.keys(calendarsById).find((key) => calendarsById[key].primary == true)
    if (k) {
      return calendarsById[k!]
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
