import React from 'react'
import { Button } from '@chakra-ui/react'
import { FiPlus } from 'react-icons/fi'

import { CalendarsContext, CalendarsContextType } from '../contexts/CalendarsContext'
import { getAuthToken, getCalendars, putCalendar, createCalendar } from '../util/Api'
import Calendar, { AccessRole } from '../models/Calendar'
import CalendarEditModal from './CalendarEditModal'

import produce from 'immer'

/**
 * Displays list of calendars.
 * TODO: Use calendar color, not event color.
 * TODO: Update selected calendars to server.
 */
export default function CalendarsPanel() {
  const {
    calendarsById,
    loadCalendars,
    updateCalendarSelect,
    addCalendar,
  } = React.useContext<CalendarsContextType>(CalendarsContext)
  const [modalActive, setModalActive] = React.useState(false)

  React.useEffect(() => {
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
    if (a.isGoogleCalendar && !b.isGoogleCalendar) {
      return 5
    }

    if (a.primary && !b.primary) {
      return -5
    } else {
      return accessRolePrecedence(a.accessRole) - accessRolePrecedence(b.accessRole)
    }
  })

  return (
    <>
      <CalendarEditModal
        isActive={modalActive}
        onCancel={() => setModalActive(false)}
        onSave={async (summary, description, timezone, backgroundColor, isGoogleCalendar) => {
          try {
            const calendar = await createCalendar(
              getAuthToken(),
              summary,
              backgroundColor,
              isGoogleCalendar,
              description,
              timezone
            )
            addCalendar(calendar)
          } catch (err) {
            // TODO: Display errors
          }

          setModalActive(false)
        }}
      />

      <span className="has-text-left has-text-weight-medium mt-3">Calendars</span>
      {calendars.length > 0 &&
        calendars.map((calendar, idx) => {
          const selected = calendar.selected || false
          return (
            <label
              key={idx}
              className="cal-checkbox-container has-text-left tag-block with-padding"
            >
              <input
                type="checkbox"
                checked={selected}
                className="cal-checkbox"
                onChange={(v) => {
                  onSelectCalendar(calendar, v.target.checked)
                }}
              />
              <span
                className="cal-checkmark"
                style={{ backgroundColor: selected ? calendar.backgroundColor : '#eee' }}
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

      <Button
        color="gray.600"
        fontWeight="normal"
        variant="link"
        onClick={() => setModalActive(true)}
        justifyContent="left"
        m="2"
      >
        <FiPlus /> add calendar
      </Button>
    </>
  )
}
