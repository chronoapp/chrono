import React, { useState, useEffect } from 'react'
import clsx from 'clsx'

import Week from './Week'
import Month from './Month'
import Event from '../models/Event'
import * as dates from '../util/dates'
import { startOfWeek, formatDateTime } from '../util/localizer'
import { hexToHSL } from './utils/Colors'
import { getAuthToken, getEvents } from '../util/Api'

import Icon from '@mdi/react'
import { mdiChevronDown, mdiChevronLeft, mdiChevronRight } from '@mdi/js'

import {
  EventActionContext,
  EventActionContextType,
  DragDropAction,
  Action,
  Direction,
} from './EventActionContext'

type Display = 'Week' | 'Month'

function Calendar() {
  const firstOfWeek = startOfWeek()
  const today = new Date()

  // TODO: Store startDate and endDate to prevent unnecessary refreshes.

  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [events, setEvents] = useState<Event[]>([])
  const [display, setDisplay] = useState<Display>('Week')
  const [displayToggleActive, setDisplayToggleActive] = useState<boolean>(false)

  // Handles Drag & Drop Events.
  const [dragDropAction, setDragDropAction] = useState<DragDropAction | undefined>(undefined)

  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)

    return function cleanup() {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [])

  useEffect(() => {
    loadCurrentViewEvents()
  }, [display, selectedDate])

  const defaultContext: EventActionContextType = {
    onStart: handleInteractionStart,
    onEnd: handleInteractionEnd,
    dragAndDropAction: dragDropAction,
    onBeginAction: handleBeginAction,

    onSelectNewEvent,
    onCancelSelection,
  }

  function handleKeyboardShortcuts(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancelSelection()
      setDisplayToggleActive(false)
    }

    if (e.key === 'w') {
      selectDisplay('Week')
    }

    if (e.key === 'm') {
      selectDisplay('Month')
    }
  }

  function handleInteractionStart() {
    if (dragDropAction) {
      setDragDropAction({ ...dragDropAction, interacting: true })
    }
  }

  function handleBeginAction(event: Event, action: Action, direction?: Direction) {
    const interacting = dragDropAction ? dragDropAction.interacting : false
    setDragDropAction({ event, action, direction, interacting })
  }

  function handleInteractionEnd(event?: Event) {
    if (event) {
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id ? event : existingEvent
      })
      setEvents(nextEvents)
    }

    setDragDropAction(undefined)
  }

  function onSelectNewEvent(startDate: Date, endDate: Date) {
    const event = new Event(-1, null, startDate, endDate, true, false, '#7986CB', '#fff')
    const nextEvents = events.map((e) => e).filter((e) => e.id !== -1)
    nextEvents.push(event)
    setEvents(nextEvents)
  }

  function onCancelSelection() {
    const nextEvents = events
      .map((e) => {
        e.creating = false
        return e
      })
      .filter((e) => e.id !== -1)
    setEvents(nextEvents)
  }

  function selectDisplay(display: Display) {
    setDisplay(display)
    setDisplayToggleActive(false)
  }

  async function loadCurrentViewEvents() {
    if (display == 'Week') {
      const start = dates.startOf(selectedDate, 'week', firstOfWeek)
      const end = dates.endOf(selectedDate, 'week', firstOfWeek)
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

    const results = events.map((event) => {
      // TODO: Figure out a better color scheme for past event colors.
      let bgColor = event.backgroundColor
      if (event.endTime < today) {
        const { h, s } = hexToHSL(event.backgroundColor)
        const hsl = `hsl(${h}, ${s}%, 85%)`
        bgColor = hsl
      }

      return new Event(
        event.id,
        event.title,
        event.startTime,
        event.endTime,
        false,
        event.allDay,
        bgColor,
        event.endTime < today ? 'hsl(0, 0%, 40%)' : '#fff'
      )
    })

    setEvents(results)
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="button is-small is-light" onClick={() => setSelectedDate(today)}>
            Today
          </div>
          <div
            className="has-text-grey-dark pl-2"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {title}
          </div>
          <button
            className="button is-text is-small is-size-6"
            onClick={() => {
              if (display == 'Week') {
                setSelectedDate(dates.subtract(selectedDate, 7, 'day'))
              } else if (display == 'Month') {
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
                setSelectedDate(dates.add(selectedDate, 1, 'month'))
              }
            }}
          >
            <span className="icon icon-button">
              <Icon path={mdiChevronRight} />
            </span>
          </button>
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
    if (display == 'Week') {
      return <Week date={selectedDate} events={events} />
    } else if (display == 'Month') {
      return <Month date={selectedDate} events={events} />
    }
  }

  return (
    <div className="cal-calendar">
      {renderDisplaySelectionHeader()}
      <EventActionContext.Provider value={defaultContext}>
        {renderCalendar()}
      </EventActionContext.Provider>
    </div>
  )
}

export default Calendar
