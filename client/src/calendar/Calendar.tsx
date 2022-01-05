import React, { useEffect, useContext } from 'react'
import produce from 'immer'
import { useRouter } from 'next/router'

import TimeGrid from './TimeGrid'
import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'
import EventEditFull from './event-edit/EventEditFull'
import useEventService from './event-edit/useEventService'
import { EventActionContext } from './EventActionContext'
import { CalendarsContext, CalendarsContextType } from '@/contexts/CalendarsContext'
import SearchResults from '@/calendar/SearchResults'

import { GlobalEvent } from '@/util/global'
import { startOfWeek, formatDateTime } from '@/util/localizer'
import * as dates from '@/util/dates'
import * as API from '@/util/Api'

function Calendar() {
  const firstOfWeek = startOfWeek()
  const today = new Date()
  const { updateEvent } = useEventService()

  // TODO: Store startDate and endDate to prevent unnecessary refreshes.
  const calendarContext = useContext<CalendarsContextType>(CalendarsContext)
  const eventsContext = useContext(EventActionContext)

  const router = useRouter()
  const searchQuery = (router.query.search as string) || ''

  useEffect(() => {
    document.addEventListener(GlobalEvent.refreshCalendar, loadCurrentViewEvents)

    return function cleanup() {
      document.removeEventListener(GlobalEvent.refreshCalendar, loadCurrentViewEvents)
    }
  }, [])

  useEffect(() => {
    loadCurrentViewEvents()
  }, [eventsContext.display, eventsContext.selectedDate, searchQuery])

  async function loadCurrentViewEvents() {
    if (searchQuery) {
      eventsContext.eventDispatch({ type: 'RESET' })
      const events = await API.searchEvents(API.getAuthToken(), searchQuery)

      eventsContext.eventDispatch({ type: 'INIT', payload: events })
    } else if (eventsContext.display == 'Day') {
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
    const events = await API.getEvents(authToken, '', formatDateTime(start), formatDateTime(end))

    eventsContext.eventDispatch({ type: 'INIT', payload: events })
  }

  function renderCalendar() {
    const { loading, eventsById, editingEvent } = eventsContext.eventState

    const selectedCalendarIds = Object.values(calendarContext.calendarsById)
      .filter((cal) => cal.selected)
      .map((cal) => cal.id)

    const eventByIdWithEditingEvent = produce(eventsById, (draft) => {
      if (editingEvent) {
        draft[editingEvent.id] = editingEvent.event
      }
    })

    const events = Object.values(eventByIdWithEditingEvent).filter(
      (event) => !event.calendar_id || selectedCalendarIds.includes(event.calendar_id)
    )

    if (searchQuery) {
      return <SearchResults events={events} search={searchQuery} />
    } else if (eventsContext.display == 'Day') {
      return (
        <TimeGrid
          updateEvent={updateEvent}
          now={eventsContext.selectedDate}
          events={events}
          range={[eventsContext.selectedDate]}
        />
      )
    } else if (eventsContext.display == 'Week') {
      return <Week date={eventsContext.selectedDate} events={events} updateEvent={updateEvent} />
    } else if (eventsContext.display == 'WorkWeek') {
      return (
        <WorkWeek date={eventsContext.selectedDate} events={events} updateEvent={updateEvent} />
      )
    } else if (eventsContext.display == 'Month') {
      return (
        <Month today={today} loading={loading} date={eventsContext.selectedDate} events={events} />
      )
    }
  }

  function renderFullEditMode() {
    const { eventState } = eventsContext
    if (eventState.editingEvent) {
      const fullEditMode = eventState.editingEvent?.editMode == 'FULL_EDIT'
      if (fullEditMode) {
        const event = eventState.editingEvent.event
        return event && <EventEditFull event={event} />
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
