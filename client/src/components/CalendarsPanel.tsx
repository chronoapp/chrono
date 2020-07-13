import React, { useState, useContext, useEffect } from 'react'
import { CalendarsContext, CalendarsContextType } from './CalendarsContext'
import { getAuthToken, getCalendars } from '../util/Api'

/**
 * Displays list of calendars.
 * TODO: Order by primary
 * TODO: Use calendar color, not event color.
 */
export default function CalendarsPanel() {
  const { calendars, loadCalendars, updateCalendarSelect } = useContext<CalendarsContextType>(
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

  return (
    <>
      <span className="has-text-left has-text-weight-medium mt-3">Calendars</span>
      {calendars.map((calendar, idx) => {
        return (
          <label key={idx} className="cal-checkbox-container has-text-left tag-block">
            <input
              type="checkbox"
              checked={calendar.selected}
              className="cal-checkbox"
              onChange={(v) => {
                updateCalendarSelect(calendar.id, v.target.checked)
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
