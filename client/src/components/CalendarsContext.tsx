import React, { createContext, useState } from 'react'
import update from 'immutability-helper'
import { normalizeArr } from '../util/normalizer'

import Calendar from '../models/Calendar'

export interface CalendarsContextType {
  calendarsById: Record<number, Calendar>
  loadCalendars: (calendars: Calendar[]) => void
  updateCalendarSelect: (calendarId: string, selected: boolean) => void
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
  }

  return (
    <CalendarsContext.Provider value={defaultContext}>{props.children}</CalendarsContext.Provider>
  )
}
