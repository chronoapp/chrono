import React, { useContext, useEffect } from 'react'
import { FiPlus } from 'react-icons/fi'

import { CalendarsContext, CalendarsContextType } from './CalendarsContext'
import { getAuthToken, getCalendars, putCalendar } from '../util/Api'
import Calendar, { AccessRole } from '../models/Calendar'

import produce from 'immer'

/**
 * Displays list of calendars.
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

    const updated = produce(calendar, (draft) => {
      draft.selected = selected
    })

    putCalendar(updated, getAuthToken())
  }

  function onClickAddCalendar(Calendar) {}

  function accessRolePrecedence(accessRole: AccessRole) {
    if (accessRole === 'owner') {
      return 0
    } else if (accessRole == 'writer') {
      return 1
    } else if (accessRole == 'reader') {
      return 2
    } else {
      return 3
    }
  }

  const calendars = Object.values(calendarsById).sort((a, b) => {
    if (a.primary && !b.primary) {
      return -5
    } else {
      return accessRolePrecedence(a.accessRole) - accessRolePrecedence(b.accessRole)
    }
  })

  return (
    <>
      <span className="has-text-left has-text-weight-medium mt-3">Calendars</span>

      {calendars.length > 0 &&
        calendars.map((calendar, idx) => {
          return (
            <label
              key={idx}
              className="cal-checkbox-container has-text-left tag-block with-padding"
            >
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

              <div className="is-flex is-justify-content-space-between has-width-100">
                <span style={{ paddingLeft: '5px', maxWidth: 'fit-content' }}>
                  {calendar.summary}
                </span>
                {calendar.isGoogleCalendar && (
                  <span className="is-align-self-right">
                    <img src={'./google-logo-bw.svg'} width={12} />
                  </span>
                )}
              </div>
            </label>
          )
        })}

      <button
        className="button is-text"
        onClick={onClickAddCalendar}
        style={{ justifyContent: 'left' }}
      >
        <FiPlus /> add calendar
      </button>
    </>
  )
}
