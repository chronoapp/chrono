import React, { createContext, useState } from 'react'
import produce from 'immer'
import { normalizeArr } from '@/lib/normalizer'

import Calendar from '@/models/Calendar'

export interface CalendarsContextType {
  calendarsById: Record<number, Calendar>
  loadCalendars: (calendars: Calendar[]) => void
  updateCalendarSelect: (calendarId: string, selected: boolean) => void
  getPrimaryCalendar: () => Calendar
  getDefaultCalendar: (calendarId: string) => Calendar
  getCalendarColor: (calendarId: string) => string
  addCalendar: (calendar: Calendar) => void
  deleteCalendar: (calendarId: string) => void
}

export const CalendarsContext = createContext<CalendarsContextType>(undefined!)

export function CalendarsContextProvider(props: any) {
  const [calendarsById, setCalendarsById] = useState<Record<number, Calendar>>({})

  const defaultContext: CalendarsContextType = {
    calendarsById: calendarsById,
    loadCalendars: (calendars: Calendar[]) => {
      setCalendarsById(normalizeArr(calendars, 'id'))
    },
    updateCalendarSelect: (calendarId: string, selected: boolean) => {
      setCalendarsById(
        produce(calendarsById, (draft) => {
          draft[calendarId].selected = selected
        })
      )
    },
    getPrimaryCalendar: () => {
      const k = Object.keys(calendarsById).find((key) => calendarsById[key].primary == true)
      return k ? calendarsById[k!] : null
    },
    getDefaultCalendar: (calendarId: string) => {
      if (calendarId) {
        return calendarsById[calendarId]
      } else {
        return defaultContext.getPrimaryCalendar()
      }
    },
    getCalendarColor: (calendarId: string) => {
      let color
      if (calendarId) {
        const calendar = calendarsById[calendarId]
        color = calendar?.backgroundColor
      } else {
        color = defaultContext.getPrimaryCalendar()?.backgroundColor
      }

      return color
    },
    addCalendar: (calendar: Calendar) => {
      setCalendarsById(
        produce(calendarsById, (draft) => {
          draft[calendar.id] = calendar
        })
      )
    },
    deleteCalendar: (calendarId: string) => {
      setCalendarsById(
        produce(calendarsById, (draft) => {
          delete draft[calendarId]
        })
      )
    },
  }

  return (
    <CalendarsContext.Provider value={defaultContext}>{props.children}</CalendarsContext.Provider>
  )
}
