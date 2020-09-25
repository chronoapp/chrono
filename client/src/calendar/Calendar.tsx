import React, { useState, useEffect, useContext } from 'react'
import clsx from 'clsx'
import Icon from '@mdi/react'
import { mdiChevronDown, mdiChevronLeft, mdiChevronRight } from '@mdi/js'

import Week from './Week'
import Month from './Month'
import * as dates from '../util/dates'
import { startOfWeek, formatDateTime } from '../util/localizer'
import { getAuthToken, getEvents } from '../util/Api'

import { CalendarsContext, CalendarsContextType } from '../components/CalendarsContext'
import { EventActionContext } from './EventActionContext'

type Display = 'Week' | 'Month'

function Calendar() {
  const firstOfWeek = startOfWeek()
  const today = new Date()

  // TODO: Store startDate and endDate to prevent unnecessary refreshes.

  const [display, setDisplay] = useState<Display>('Week')
  const [displayToggleActive, setDisplayToggleActive] = useState<boolean>(false)

  const calendarContext = useContext<CalendarsContextType>(CalendarsContext)
  const eventsContext = useContext(EventActionContext)

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return function cleanup() {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [])

  useEffect(() => {
    loadCurrentViewEvents()
  }, [display, eventsContext.selectedDate])

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      eventsContext.eventDispatch({ type: 'CANCEL_SELECT' })
      setDisplayToggleActive(false)
    }

    // if (eventsContext.eventState.editingEventId === null) {
    //   if (e.key === 'w') {
    //     selectDisplay('Week')
    //   }

    //   if (e.key === 'm') {
    //     selectDisplay('Month')
    //   }
    // }
  }

  function selectDisplay(display: Display) {
    if (display === 'Month') {
      // HACK: Prevents flicker when switching months
      eventsContext.eventDispatch({ type: 'INIT', payload: [] })
    }

    setDisplay(display)
    setDisplayToggleActive(false)
  }

  async function loadCurrentViewEvents() {
    if (display == 'Week') {
      const lastWeek = dates.subtract(eventsContext.selectedDate, 1, 'week')
      const nextWeek = dates.add(eventsContext.selectedDate, 1, 'week')

      const start = dates.startOf(lastWeek, 'week', firstOfWeek)
      const end = dates.endOf(nextWeek, 'week', firstOfWeek)
      loadEvents(start, end)
    }

    if (display == 'Month') {
      const month = dates.visibleDays(eventsContext.selectedDate, firstOfWeek)
      const start = month[0]
      const end = month[month.length - 1]
      loadEvents(start, end)
    }
  }

  async function loadEvents(start: Date, end: Date) {
    const authToken = getAuthToken()
    const events = await getEvents(authToken, '', formatDateTime(start), formatDateTime(end))

    eventsContext.eventDispatch({ type: 'INIT', payload: events })
  }

  function renderDisplaySelectionHeader() {
    const title = getViewTitle()

    return (
      <div
        className={clsx({ dropdown: true, 'is-active': displayToggleActive })}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingRight: '2rem',
          paddingBottom: '0.5rem',
          paddingTop: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            className="button is-small is-light"
            onClick={() => eventsContext.setSelectedDate(today)}
          >
            Today
          </div>
          <button
            className="button is-text is-small is-size-6"
            onClick={() => {
              if (display == 'Week') {
                eventsContext.setSelectedDate(dates.subtract(eventsContext.selectedDate, 7, 'day'))
              } else if (display == 'Month') {
                // HACK: Prevents flicker when switching months
                eventsContext.eventDispatch({ type: 'INIT', payload: [] })
                eventsContext.setSelectedDate(
                  dates.subtract(eventsContext.selectedDate, 1, 'month')
                )
              }
            }}
          >
            <span className="icon">
              <Icon path={mdiChevronLeft} size={1} />
            </span>
          </button>
          <button
            className="button is-text is-small is-size-6"
            onClick={() => {
              if (display == 'Week') {
                eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 7, 'day'))
              } else if (display == 'Month') {
                eventsContext.eventDispatch({ type: 'INIT', payload: [] })
                eventsContext.setSelectedDate(dates.add(eventsContext.selectedDate, 1, 'month'))
              }
            }}
          >
            <span className="icon icon-button">
              <Icon path={mdiChevronRight} size={1} />
            </span>
          </button>
          <div
            className="has-text-grey-dark pl-2"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {title}
          </div>
        </div>
        <div className="calendar-dropdown">
          <div className="dropdown-trigger">
            <button
              className="button is-small"
              aria-haspopup="true"
              aria-controls="dropdown-menu"
              onClick={() => setDisplayToggleActive(!displayToggleActive)}
            >
              <span>{display}</span>
              <span className="icon is-small">
                <Icon path={mdiChevronDown} size={1} />
              </span>
            </button>
          </div>

          <div
            className="dropdown-menu is-small"
            id="dropdown-menu"
            role="menu"
            style={{ left: 'auto', minWidth: '10rem', right: '1em' }}
          >
            <div className="dropdown-content has-text-left">
              <a onClick={() => selectDisplay('Week')} className="dropdown-item">
                Week
              </a>
              <a onClick={() => selectDisplay('Month')} className="dropdown-item">
                Month
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function getViewTitle() {
    if (display == 'Week') {
      return Week.getTitle(eventsContext.selectedDate)
    } else if (display == 'Month') {
      return Month.getTitle(eventsContext.selectedDate)
    }
  }

  function renderCalendar() {
    const { loading, eventsById } = eventsContext.eventState

    const selectedCalendarIds = Object.values(calendarContext.calendarsById)
      .filter((cal) => cal.selected)
      .map((cal) => cal.id)
    const events = Object.values(eventsById).filter(
      (event) => !event.calendar_id || selectedCalendarIds.includes(event.calendar_id)
    )

    if (display == 'Week') {
      return <Week date={eventsContext.selectedDate} events={events} />
    } else if (display == 'Month') {
      return (
        <Month today={today} loading={loading} date={eventsContext.selectedDate} events={events} />
      )
    }
  }

  return (
    <div className="cal-calendar">
      {renderDisplaySelectionHeader()}
      {renderCalendar()}
    </div>
  )
}

export default Calendar
