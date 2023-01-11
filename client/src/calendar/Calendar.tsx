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

import TimeGrid from './TimeGrid'
import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'
import EventEditFull from './event-edit/EventEditFull'
import ConfirmDeleteRecurringEventModal from './event-edit/ConfirmDeleteRecurringEventModal'
import ConfirmUpdateRecurringEventModal from './event-edit/ConfirmUpdateRecurringEventModal'

import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import {
  eventsState,
  displayState,
  editingEventState,
  allVisibleEventsSelector,
} from '@/state/EventsState'
import useEventActions from '@/state/useEventActions'

/**
 * TODO: Store startDate and endDate to prevent unnecessary refreshes.
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
  const [update, setUpdater] = React.useState(generateGuid())

  useKeyPress(['ArrowLeft', 'ArrowRight'], onKeyPress)

  const handleRefreshEvent = React.useCallback(() => {
    setUpdater(generateGuid())
  }, [])

  useEffect(() => {
    document.addEventListener(GlobalEvent.refreshCalendar, handleRefreshEvent)

    return function cleanup() {
      document.removeEventListener(GlobalEvent.refreshCalendar, handleRefreshEvent)
    }
  }, [handleRefreshEvent])

  function onKeyPress(e) {
    e.preventDefault()

    if (e.key === 'ArrowLeft') {
      const prevWeek = dates.subtract(display.selectedDate, 1, 'week')
      setDisplay((state) => ({ ...state, selectedDate: prevWeek }))
    } else if (e.key === 'ArrowRight') {
      const nextWeek = dates.add(display.selectedDate, 1, 'week')
      setDisplay((state) => ({ ...state, selectedDate: nextWeek }))
    }
  }

  useEffect(() => {
    loadCurrentViewEvents()
  }, [display, calendars.calendarsById, update])

  async function loadCurrentViewEvents() {
    if (display.view == 'Day') {
      const start = dates.startOf(display.selectedDate, 'day')
      const end = dates.endOf(display.selectedDate, 'day')

      loadEvents(start, end)
    } else if (display.view == 'Week' || display.view == 'WorkWeek') {
      const lastWeek = dates.subtract(display.selectedDate, 1, 'week')
      const nextWeek = dates.add(display.selectedDate, 1, 'week')

      const start = dates.startOf(lastWeek, 'week', firstOfWeek)
      const end = dates.endOf(nextWeek, 'week', firstOfWeek)
      loadEvents(start, end)
    } else if (display.view == 'Month') {
      const month = dates.visibleDays(display.selectedDate, firstOfWeek)
      const start = month[0]
      const end = month[month.length - 1]
      loadEvents(start, end)
    }

    // TODO: Cancel selections if the previous display is different (i.e. transition from month to week view)
  }

  async function loadEvents(start: Date, end: Date) {
    const eventPromises = Object.values(calendars.calendarsById)
      .filter((cal) => cal.selected)
      .map((calendar) => {
        try {
          return {
            eventsPromise: API.getCalendarEvents(
              calendar.id,
              formatDateTime(start),
              formatDateTime(end)
            ),
            calendarId: calendar.id,
          }
        } catch (err) {
          return { eventsPromise: Promise.resolve([]), calendarId: calendar.id }
        }
      })

    for (const e of eventPromises) {
      const calendarEvents = await e.eventsPromise
      eventActions.loadEvents(e.calendarId, calendarEvents)
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
    if (editingEvent?.confirmAction) {
      switch (editingEvent.confirmAction) {
        case 'DELETE_RECURRING_EVENT':
          return (
            <ConfirmDeleteRecurringEventModal
              eventService={eventService}
              event={editingEvent.event}
            />
          )
        case 'UPDATE_RECURRING_EVENT':
          return (
            <ConfirmUpdateRecurringEventModal
              eventService={eventService}
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
