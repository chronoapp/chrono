import React, { useEffect, useContext } from 'react'
import produce from 'immer'
import { useRouter } from 'next/router'

import TimeGrid from './TimeGrid'
import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'
import EventEditFull from './event-edit/EventEditFull'
import useEventService, { EventService } from './event-edit/useEventService'
import { EventActionContext } from './EventActionContext'
import { CalendarsContext, CalendarsContextType } from '@/contexts/CalendarsContext'
import SearchResults from '@/calendar/SearchResults'

import { GlobalEvent } from '@/util/global'
import { startOfWeek } from '@/util/localizer'
import * as dates from '@/util/dates'
import * as API from '@/util/Api'

function Calendar() {
  const firstOfWeek = startOfWeek()
  const today = new Date()
  const eventService: EventService = useEventService()

  // TODO: Store startDate and endDate to prevent unnecessary refreshes.
  const calendarContext = useContext<CalendarsContextType>(CalendarsContext)
  const eventsContext = useContext(EventActionContext)

  const router = useRouter()
  const searchQuery = (router.query.search as string) || ''
  const [update, setUpdater] = React.useState(0)

  useEffect(() => {
    document.addEventListener(GlobalEvent.refreshCalendar, () => setUpdater(update + 1))

    return function cleanup() {
      document.removeEventListener(GlobalEvent.refreshCalendar, () => setUpdater(update + 1))
    }
  }, [])

  useEffect(() => {
    loadCurrentViewEvents()
  }, [eventsContext.display, eventsContext.selectedDate, calendarContext.calendarsById, update])

  async function loadCurrentViewEvents() {
    if (eventsContext.display == 'Day') {
      const start = dates.startOf(eventsContext.selectedDate, 'day')
      const end = dates.endOf(eventsContext.selectedDate, 'day')

      loadEvents(start, end)
    } else if (eventsContext.display == 'Week' || eventsContext.display == 'WorkWeek') {
      const lastWeek = dates.subtract(eventsContext.selectedDate, 1, 'week')
      const nextWeek = dates.add(eventsContext.selectedDate, 1, 'week')

      const start = dates.startOf(lastWeek, 'week', firstOfWeek)
      const end = dates.endOf(nextWeek, 'week', firstOfWeek)
      loadEvents(start, end)
    } else if (eventsContext.display == 'Month') {
      const month = dates.visibleDays(eventsContext.selectedDate, firstOfWeek)
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
      Object.values(calendarContext.calendarsById)
    )

    eventsContext.eventDispatch({
      type: 'INIT_EVENTS',
      payload: { eventsByCalendar },
    })
  }

  function getAllVisibleEvents() {
    const { editingEvent, eventsByCalendar } = eventsContext.eventState
    const selectedCalendarIds = Object.values(calendarContext.calendarsById)
      .filter((cal) => cal.selected)
      .map((cal) => cal.id)

    const defaultCalendar = calendarContext.getPrimaryCalendar()

    let eventWithEditing = Object.fromEntries(
      selectedCalendarIds.map((calId) => {
        return [calId, eventsByCalendar[calId] || {}]
      })
    )

    if (editingEvent) {
      eventWithEditing = produce(eventWithEditing, (draft) => {
        const calendarId = editingEvent.event.calendar_id || defaultCalendar.id

        if (draft.hasOwnProperty(calendarId)) {
          if (editingEvent.originalCalendarId) {
            delete draft[editingEvent.originalCalendarId][editingEvent.id]
          }

          draft[calendarId][editingEvent.id] = editingEvent.event
        }
        return draft
      })
    }

    return Object.values(eventWithEditing).flatMap((eventMap) => {
      return Object.values(eventMap)
    })
  }

  function renderCalendar() {
    const { loading } = eventsContext.eventState
    const events = getAllVisibleEvents()

    if (searchQuery) {
      return <SearchResults events={events} searchQuery={searchQuery} eventService={eventService} />
    } else if (eventsContext.display == 'Day') {
      return (
        <TimeGrid
          eventService={eventService}
          now={eventsContext.selectedDate}
          events={events}
          range={[eventsContext.selectedDate]}
          getPrimaryCalendar={calendarContext.getPrimaryCalendar}
        />
      )
    } else if (eventsContext.display == 'Week') {
      return (
        <Week
          date={eventsContext.selectedDate}
          events={events}
          eventService={eventService}
          getPrimaryCalendar={calendarContext.getPrimaryCalendar}
        />
      )
    } else if (eventsContext.display == 'WorkWeek') {
      return (
        <WorkWeek
          date={eventsContext.selectedDate}
          events={events}
          eventService={eventService}
          getPrimaryCalendar={calendarContext.getPrimaryCalendar}
        />
      )
    } else if (eventsContext.display == 'Month') {
      return (
        <Month
          today={today}
          loading={loading}
          date={eventsContext.selectedDate}
          events={events}
          eventService={eventService}
          getPrimaryCalendar={calendarContext.getPrimaryCalendar}
        />
      )
    }
  }

  function renderFullEditMode() {
    const { eventState } = eventsContext
    if (eventState.editingEvent) {
      const fullEditMode = eventState.editingEvent?.editMode == 'FULL_EDIT'
      if (fullEditMode) {
        const event = eventState.editingEvent.event
        return event && <EventEditFull eventService={eventService} event={event} />
      }
    }
  }

  return (
    <div className="cal-calendar">
      {renderCalendar()}
      {renderFullEditMode()}
    </div>
  )
}

export default Calendar
