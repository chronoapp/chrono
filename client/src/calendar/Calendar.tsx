import React, { useEffect } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { DateTime } from 'luxon'

import useQuery from '@/lib/hooks/useQuery'
import useEventService, { EventService } from './event-edit/useEventService'
import SearchResults from '@/calendar/SearchResults'

import { GlobalEvent } from '@/util/global'
import useKeyPress from '@/lib/hooks/useKeyPress'

import * as dates from '@/util/dates-luxon'
import { firstDayOfWeek } from '@/util/localizer-luxon'

import { generateGuid } from '@/lib/uuid'
import useGlobalEventListener from '@/util/useGlobalEventListener'

import TimeGrid from './TimeGrid'
import Week from './Week'
import Month from './Month'
import WorkWeek from './WorkWeek'
import EventEditFull from './event-edit/EventEditFull'
import ConfirmDeleteEventModal from './event-edit/ConfirmDeleteEventModal'
import ConfirmUpdateEventModal from './event-edit/ConfirmUpdateEventModal'
import ConfirmCreateEventModal from './event-edit/ConfirmCreateEventModal'

import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import { eventsState, editingEventState, allVisibleEventsSelector } from '@/state/EventsState'
import { calendarViewState, calendarViewStateUserTz } from '@/state/CalendarViewState'

/**
 * The main calendar component.
 */
function Calendar() {
  const eventService: EventService = useEventService()

  const calendars = useRecoilValue(calendarsState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

  const events = useRecoilValue(eventsState)

  const [calendarView, setCalendarView] = useRecoilState(calendarViewState)
  const calendarViewTz = useRecoilValue(calendarViewStateUserTz)

  const editingEvent = useRecoilValue(editingEventState)
  const allVisibleEvents = useRecoilValue(allVisibleEventsSelector)

  const queryParams = useQuery()
  const searchQuery = (queryParams.get('search') as string) || ''

  const firstOfWeek = firstDayOfWeek()

  useKeyPress(['ArrowLeft', 'ArrowRight'], onKeyPress)

  // Refresh the calendar when we receive a refresh event.
  const [refreshId, setRefreshId] = React.useState(generateGuid())

  const handleRefreshEvent = React.useCallback(() => {
    // TODO: Only refresh the calendar that was updated, instead of all calendars.
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
  }, [calendarView, calendars.calendarsById, refreshId])

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

    if (calendarView.view == 'Day') {
      if (e.key === 'ArrowLeft') {
        const prevDay = calendarViewTz.selectedDate.minus({ days: 1 })
        setCalendarView((state) => ({ ...state, selectedDate: prevDay }))

        // setDisplay((state) => ({ ...state, selectedDate: prevDay }))
      } else if (e.key === 'ArrowRight') {
        const nextDay = calendarViewTz.selectedDate.plus({ days: 1 })
        setCalendarView((state) => ({ ...state, selectedDate: nextDay }))
      }
    } else if (calendarView.view == 'Week' || calendarView.view == 'WorkWeek') {
      if (e.key === 'ArrowLeft') {
        const prevWeek = calendarViewTz.selectedDate.minus({ weeks: 1 })
        setCalendarView((state) => ({ ...state, selectedDate: prevWeek }))
      } else if (e.key === 'ArrowRight') {
        const nextWeek = calendarViewTz.selectedDate.plus({ weeks: 1 })
        setCalendarView((state) => ({ ...state, selectedDate: nextWeek }))
      }
    } else if (calendarView.view == 'Month') {
      if (e.key === 'ArrowLeft') {
        const prevMonth = calendarViewTz.selectedDate.minus({ months: 1 })
        setCalendarView((state) => ({ ...state, selectedDate: prevMonth }))
      } else if (e.key === 'ArrowRight') {
        const nextMonth = calendarViewTz.selectedDate.plus({ months: 1 })
        setCalendarView((state) => ({ ...state, selectedDate: nextMonth }))
      }
    }
  }

  async function loadCurrentViewEvents(signal: AbortSignal) {
    if (calendarView.view == 'Day') {
      const start = calendarViewTz.selectedDate.startOf('day')
      const end = calendarViewTz.selectedDate.endOf('day')

      eventService.loadAllEvents(start, end, signal)
    } else if (calendarView.view == 'Week' || calendarView.view == 'WorkWeek') {
      const lastWeek = calendarViewTz.selectedDate.minus({ weeks: 1 })
      const nextWeek = calendarViewTz.selectedDate.plus({ weeks: 1 })

      const start = dates.startOfWeek(lastWeek, firstOfWeek)
      const end = dates.endOfWeek(nextWeek, firstOfWeek)

      eventService.loadAllEvents(start, end, signal)
    } else if (calendarView.view == 'Month') {
      const month = dates.visibleDays(calendarViewTz.selectedDate, firstOfWeek)
      const start = month[0]
      const end = month[month.length - 1]
      eventService.loadAllEvents(start, end, signal)
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
    } else if (calendarView.view == 'Day') {
      return (
        <TimeGrid
          eventService={eventService}
          now={calendarViewTz.selectedDate}
          events={allVisibleEvents}
          range={[calendarViewTz.selectedDate]}
          primaryCalendar={primaryCalendar}
        />
      )
    } else if (calendarView.view == 'Week') {
      return (
        <Week
          now={calendarViewTz.now}
          date={calendarViewTz.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
        />
      )
    } else if (calendarView.view == 'WorkWeek') {
      return (
        <WorkWeek
          date={calendarViewTz.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
        />
      )
    } else if (calendarView.view == 'Month') {
      return (
        <Month
          now={calendarViewTz.now}
          loading={events.loading}
          date={calendarViewTz.selectedDate}
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
