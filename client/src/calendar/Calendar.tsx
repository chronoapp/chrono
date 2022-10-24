import React, { useEffect } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { useRouter } from 'next/router'

import useEventService, { EventService } from './event-edit/useEventService'
import SearchResults from '@/calendar/SearchResults'

import { GlobalEvent } from '@/util/global'
import { startOfWeek } from '@/util/localizer'
import useKeyPress from '@/lib/hooks/useKeyPress'
import * as dates from '@/util/dates'
import * as API from '@/util/Api'

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
  const eventInteraction = useEventActions()

  const calendars = useRecoilValue(calendarsState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

  const events = useRecoilValue(eventsState)
  const [display, setDisplay] = useRecoilState(displayState)
  const editingEvent = useRecoilValue(editingEventState)
  const allVisibleEvents = useRecoilValue(allVisibleEventsSelector)

  const router = useRouter()
  const searchQuery = (router.query.search as string) || ''
  const [update, setUpdater] = React.useState(0)

  useKeyPress(['ArrowLeft', 'ArrowRight'], onKeyPress)

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
    document.addEventListener(GlobalEvent.refreshCalendar, () => setUpdater(update + 1))

    return function cleanup() {
      document.removeEventListener(GlobalEvent.refreshCalendar, () => setUpdater(update + 1))
    }
  }, [])

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
    const authToken = API.getAuthToken()
    const eventsByCalendar = await API.getAllEvents(
      authToken,
      start,
      end,
      Object.values(calendars.calendarsById)
    )

    eventInteraction.initEvents(eventsByCalendar)
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
    if (fullEditMode) {
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
