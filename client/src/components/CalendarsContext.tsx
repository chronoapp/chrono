import React, { createContext, useState } from 'react'

import Calendar from '../models/Calendar'

export interface CalendarsContextType {
  calendars: Calendar[]
  loadCalendars: (calendars: Calendar[]) => void
  updateCalendarSelect: (calendarId: string, selected: boolean) => void
}

export const CalendarsContext = createContext<CalendarsContextType>(undefined)

export function CalendarsContextProvider(props: any) {
  const [calendars, setCalendars] = useState<Calendar[]>([])

  const defaultContext: CalendarsContextType = {
    calendars: calendars,
    loadCalendars: (calendars: Calendar[]) => {
      setCalendars(calendars)
    },
    updateCalendarSelect: (calendarId: string, selected: boolean) => {
      const updatedCalendars = calendars.map((cal) => {
        if (cal.id === calendarId) {
          cal.selected = selected
          return cal
        } else {
          return cal
        }
      })
      setCalendars(updatedCalendars)
    },
  }

  return (
    <CalendarsContext.Provider value={defaultContext}>{props.children}</CalendarsContext.Provider>
  )
}
