import React, { useState, useEffect, useContext } from 'react'
import clsx from 'clsx'

import Week from './Week'
import Month from './Month'
import * as dates from '../util/dates'
import { startOfWeek, formatDateTime } from '../util/localizer'
import { getAuthToken, getEvents } from '../util/Api'

import Icon from '@mdi/react'
import { mdiChevronDown, mdiChevronLeft, mdiChevronRight } from '@mdi/js'

import { EventActionContext } from './EventActionContext'

type Display = 'Week' | 'Month'

function Calendar() {
  const firstOfWeek = startOfWeek()
  const today = new Date()

  // TODO: Store startDate and endDate to prevent unnecessary refreshes.

  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [display, setDisplay] = useState<Display>('Week')
  const [displayToggleActive, setDisplayToggleActive] = useState<boolean>(false)

  const eventActionContext = useContext(EventActionContext)

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return function cleanup() {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [])

  useEffect(() => {
    loadCurrentViewEvents()
  }, [display, selectedDate])

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      eventActionContext.eventDispatch({ type: 'CANCEL_SELECT' })
      setDisplayToggleActive(false)
    }

    if (e.key === 'w') {
      selectDisplay('Week')
    }

    if (e.key === 'm') {
      selectDisplay('Month')
    }
  }

  function selectDisplay(display: Display) {
    if (display === 'Month') {
      // HACK: Prevents flicker when switching months
      eventActionContext.eventDispatch({ type: 'INIT', payload: [] })
    }

    setDisplay(display)
    setDisplayToggleActive(false)
  }

  async function loadCurrentViewEvents() {
    eventActionContext.eventDispatch({ type: 'START_LOAD' })

    if (display == 'Week') {
      const lastWeek = dates.subtract(selectedDate, 1, 'week')
      const nextWeek = dates.add(selectedDate, 1, 'week')

      const start = dates.startOf(lastWeek, 'week', firstOfWeek)
      const end = dates.endOf(nextWeek, 'week', firstOfWeek)
      loadEvents(start, end)
    }

    if (display == 'Month') {
      const month = dates.visibleDays(selectedDate, firstOfWeek)
      const start = month[0]
      const end = month[month.length - 1]
      loadEvents(start, end)
    }
  }

  async function loadEvents(start: Date, end: Date) {
    const authToken = getAuthToken()
    const events = await getEvents(authToken, '', formatDateTime(start), formatDateTime(end))

    eventActionContext.eventDispatch({ type: 'INIT', payload: events })
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
          <div className="button is-small is-light" onClick={() => setSelectedDate(today)}>
            Today
          </div>
          <button
            className="button is-text is-small is-size-6"
            onClick={() => {
              if (display == 'Week') {
                setSelectedDate(dates.subtract(selectedDate, 7, 'day'))
              } else if (display == 'Month') {
                // HACK: Prevents flicker when switching months
                eventActionContext.eventDispatch({ type: 'INIT', payload: [] })
                setSelectedDate(dates.subtract(selectedDate, 1, 'month'))
              }
            }}
          >
            <span className="icon">
              <Icon path={mdiChevronLeft} />
            </span>
          </button>
          <button
            className="button is-text is-small is-size-6"
            onClick={() => {
              if (display == 'Week') {
                setSelectedDate(dates.add(selectedDate, 7, 'day'))
              } else if (display == 'Month') {
                eventActionContext.eventDispatch({ type: 'INIT', payload: [] })
                setSelectedDate(dates.add(selectedDate, 1, 'month'))
              }
            }}
          >
            <span className="icon icon-button">
              <Icon path={mdiChevronRight} />
            </span>
          </button>
          <div
            className="has-text-grey-dark pl-2"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {title}
          </div>
        </div>
        <div>
          <div className="dropdown-trigger">
            <button
              className="button is-small"
              aria-haspopup="true"
              aria-controls="dropdown-menu"
              onClick={() => setDisplayToggleActive(!displayToggleActive)}
            >
              <span>{display}</span>
              <span className="icon is-small">
                <Icon path={mdiChevronDown} />
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
      return Week.getTitle(selectedDate)
    } else if (display == 'Month') {
      return Month.getTitle(selectedDate)
    }
  }

  function renderCalendar() {
    const { events, loading } = eventActionContext.eventState
    if (display == 'Week') {
      return <Week date={selectedDate} events={events} />
    } else if (display == 'Month') {
      return <Month loading={loading} date={selectedDate} events={events} />
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
