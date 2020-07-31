import React, { createContext, useState } from 'react'
import update from 'immutability-helper'
import { normalizeArr } from '../lib/normalizer'

import Calendar from '../models/Calendar'

export interface CalendarsContextType {
  calendarsById: Record<number, Calendar>
  loadCalendars: (calendars: Calendar[]) => void
  updateCalendarSelect: (calendarId: string, selected: boolean) => void
  getPrimaryCalendar: () => Calendar
  getCalendarColor: (calendarId: string) => string
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
      const updatedCalendars = update(calendarsById, {
        [calendarId]: { $merge: { selected: selected } },
      })
      setCalendarsById(updatedCalendars)
    },
    getPrimaryCalendar: () => {
      const k = Object.keys(calendarsById).find((key) => calendarsById[key].primary == true)
      return calendarsById[k!]
    },
    getCalendarColor: (calendarId: string) => {
      let color
      if (calendarId) {
        const calendar = calendarsById[calendarId]
        color = calendar ? calendar.backgroundColor : '#fff'
      } else {
        color = defaultContext.getPrimaryCalendar().backgroundColor
      }
      return color
    },
  }

  return (
    <CalendarsContext.Provider value={defaultContext}>{props.children}</CalendarsContext.Provider>
  )
}
