import React, { useEffect } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import useQuery from '@/lib/hooks/useQuery'

import useEventService, { EventService } from './event-edit/useEventService'
import SearchResults from '@/calendar/SearchResults'

import { GlobalEvent } from '@/util/global'
import { startOfWeek, formatDateTime } from '@/util/localizer'
import useKeyPress from '@/lib/hooks/useKeyPress'
import * as dates from '@/util/dates'
import * as API from '@/util/Api'
import { generateGuid } from '@/lib/uuid'
import useGlobalEventListener from '@/util/useGlobalEventListener'
import useEventActions from '@/state/useEventActions'

import TimeGrid from './TimeGrid'
import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'
import EventEditFull from './event-edit/EventEditFull'
import ConfirmDeleteEventModal from './event-edit/ConfirmDeleteEventModal'
import ConfirmUpdateEventModal from './event-edit/ConfirmUpdateEventModal'
import ConfirmCreateEventModal from './event-edit/ConfirmCreateEventModal'

import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import {
  eventsState,
  displayState,
  editingEventState,
  allVisibleEventsSelector,
} from '@/state/EventsState'

/**
 * The main calendar component.
 */
function Calendar() {
  const firstOfWeek = startOfWeek()
  const today = new Date()
  const eventService: EventService = useEventService()
  const eventActions = useEventActions()

  const calendars = useRecoilValue(calendarsState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

  const events = useRecoilValue(eventsState)
  const [display, setDisplay] = useRecoilState(displayState)
  const editingEvent = useRecoilValue(editingEventState)
  const allVisibleEvents = useRecoilValue(allVisibleEventsSelector)

  const queryParams = useQuery()
  const searchQuery = (queryParams.get('search') as string) || ''

  useKeyPress(['ArrowLeft', 'ArrowRight'], onKeyPress)

  // Refresh the calendar when we receive a refresh event.
  const [refreshId, setRefreshId] = React.useState(generateGuid())

  const handleRefreshEvent = React.useCallback(() => {
    setRefreshId(generateGuid())
  }, [])

  useGlobalEventListener(GlobalEvent.refreshCalendar, handleRefreshEvent)

  useEffect(() => {
    // Aborts any pending requests after the component is unmounted.
    const controller = new AbortController()
    const { signal } = controller

    loadCurrentViewEvents(signal)

    return () => {
      controller.abort()
    }
  }, [display, calendars.calendarsById, refreshId])

  /**
   * Keyboard shortcuts.
   */
  function onKeyPress(e) {
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'DIV'
    ) {
      return
    }

    e.preventDefault()

    if (display.view == 'Day') {
      if (e.key === 'ArrowLeft') {
        const prevDay = dates.subtract(display.selectedDate, 1, 'day')
        setDisplay((state) => ({ ...state, selectedDate: prevDay }))
      } else if (e.key === 'ArrowRight') {
        const nextDay = dates.add(display.selectedDate, 1, 'day')
        setDisplay((state) => ({ ...state, selectedDate: nextDay }))
      }
    } else if (display.view == 'Week' || display.view == 'WorkWeek') {
      if (e.key === 'ArrowLeft') {
        const prevWeek = dates.subtract(display.selectedDate, 1, 'week')
        setDisplay((state) => ({ ...state, selectedDate: prevWeek }))
      } else if (e.key === 'ArrowRight') {
        const nextWeek = dates.add(display.selectedDate, 1, 'week')
        setDisplay((state) => ({ ...state, selectedDate: nextWeek }))
      }
    } else if (display.view == 'Month') {
      if (e.key === 'ArrowLeft') {
        const prevMonth = dates.subtract(display.selectedDate, 1, 'month')
        setDisplay((state) => ({ ...state, selectedDate: prevMonth }))
      } else if (e.key === 'ArrowRight') {
        const nextMonth = dates.add(display.selectedDate, 1, 'month')
        setDisplay((state) => ({ ...state, selectedDate: nextMonth }))
      }
    }
  }

  async function loadCurrentViewEvents(signal: AbortSignal) {
    if (display.view == 'Day') {
      const start = dates.startOf(display.selectedDate, 'day')
      const end = dates.endOf(display.selectedDate, 'day')

      loadEvents(start, end, signal)
    } else if (display.view == 'Week' || display.view == 'WorkWeek') {
      const lastWeek = dates.subtract(display.selectedDate, 1, 'week')
      const nextWeek = dates.add(display.selectedDate, 1, 'week')

      const start = dates.startOf(lastWeek, 'week', firstOfWeek)
      const end = dates.endOf(nextWeek, 'week', firstOfWeek)
      loadEvents(start, end, signal)
    } else if (display.view == 'Month') {
      const month = dates.visibleDays(display.selectedDate, firstOfWeek)
      const start = month[0]
      const end = month[month.length - 1]
      loadEvents(start, end, signal)
    }
  }

  async function loadEvents(start: Date, end: Date, signal: AbortSignal) {
    eventActions.initEmptyEvents()

    const eventPromises = Object.values(calendars.calendarsById)
      .filter((cal) => cal.selected)
      .map((calendar) => {
        try {
          return {
            eventsPromise: API.getCalendarEvents(
              calendar.id,
              formatDateTime(start),
              formatDateTime(end),
              signal
            ),
            calendarId: calendar.id,
          }
        } catch (err) {
          return { eventsPromise: Promise.resolve([]), calendarId: calendar.id }
        }
      })

    for (const e of eventPromises) {
      try {
        const calendarEvents = await e.eventsPromise
        eventActions.loadEvents(e.calendarId, calendarEvents)
      } catch (err) {
        const isAbortError = err instanceof Error && err.name === 'AbortError'
        if (!isAbortError) {
          throw err
        }
      }
    }
  }

  function renderCalendar() {
    if (!primaryCalendar) {
      return
    }

    if (searchQuery) {
      return (
        <SearchResults
          events={allVisibleEvents}
          searchQuery={searchQuery}
          eventService={eventService}
        />
      )
    } else if (display.view == 'Day') {
      return (
        <TimeGrid
          eventService={eventService}
          now={display.selectedDate}
          events={allVisibleEvents}
          range={[display.selectedDate]}
          primaryCalendar={primaryCalendar}
        />
      )
    } else if (display.view == 'Week') {
      return (
        <Week
          date={display.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
        />
      )
    } else if (display.view == 'WorkWeek') {
      return (
        <WorkWeek
          date={display.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
        />
      )
    } else if (display.view == 'Month') {
      return (
        <Month
          today={today}
          loading={events.loading}
          date={display.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
        />
      )
    }
  }

  function renderFullEditMode() {
    const fullEditMode = editingEvent?.editMode == 'FULL_EDIT'
    if (fullEditMode && editingEvent) {
      return <EventEditFull eventService={eventService} event={editingEvent.event} />
    }
  }

  function renderConfirmationDialog() {
    if (editingEvent?.updateContext) {
      switch (editingEvent.updateContext.eventEditAction) {
        case 'DELETE':
          return (
            <ConfirmDeleteEventModal
              eventService={eventService}
              updateContext={editingEvent.updateContext}
              event={editingEvent.event}
            />
          )
        case 'UPDATE':
          return (
            <ConfirmUpdateEventModal
              eventService={eventService}
              updateContext={editingEvent.updateContext}
              event={editingEvent.event}
            />
          )
        case 'CREATE':
          return (
            <ConfirmCreateEventModal
              eventService={eventService}
              updateContext={editingEvent.updateContext}
              event={editingEvent.event}
            />
          )
        default:
          throw new Error('Unknown confirm action')
      }
    }
  }

  return (
    <div className="cal-calendar">
      {renderCalendar()}
      {renderFullEditMode()}
      {renderConfirmationDialog()}
    </div>
  )
}

export default Calendar
