import React, { useContext, useEffect } from 'react'
import { CalendarsContext, CalendarsContextType } from './CalendarsContext'
import { getAuthToken, getCalendars, putCalendar } from '../util/Api'
import Calendar from '../models/Calendar'

/**
 * Displays list of calendars.
 * TODO: Order by primary
 * TODO: Use calendar color, not event color.
 * TODO: Update selected calendars to server.
 */
export default function CalendarsPanel() {
  const { calendarsById, loadCalendars, updateCalendarSelect } = useContext<CalendarsContextType>(
    CalendarsContext
  )

  useEffect(() => {
    async function init() {
      const authToken = getAuthToken()
      const calendars = await getCalendars(authToken)
      loadCalendars(calendars)
    }
    init()
  }, [])

  function onSelectCalendar(calendar: Calendar, selected: boolean) {
    updateCalendarSelect(calendar.id, selected)
    const updated = Object.assign({}, calendar)
    updated.selected = selected
    putCalendar(updated, getAuthToken())
  }

  const calendars = Object.values(calendarsById).sort((a, b) => {
    if (a.primary === true && b.primary !== true) {
      return 0
    } else if (a.accessRole == 'owner') {
      return 1
    } else if (a.accessRole == 'writer') {
      return 2
    } else if (a.accessRole == 'reader') {
      return 3
    }

    return 4
  })

  return (
    <>
      <span className="has-text-left has-text-weight-medium mt-3">Calendars</span>
      {calendars.length > 0 &&
        calendars.map((calendar, idx) => {
          return (
            <label key={idx} className="cal-checkbox-container has-text-left tag-block">
              <input
                type="checkbox"
                checked={calendar.selected}
                className="cal-checkbox"
                onChange={(v) => {
                  onSelectCalendar(calendar, v.target.checked)
                }}
              />
              <span
                className="cal-checkmark"
                style={{ backgroundColor: calendar.selected ? calendar.backgroundColor : '#eee' }}
              ></span>
              <span style={{ paddingLeft: '5px' }}>{calendar.summary}</span>
            </label>
          )
        })}
    </>
  )
}
