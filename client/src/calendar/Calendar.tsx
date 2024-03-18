import React, { useEffect } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Box } from '@chakra-ui/react'

import useQuery from '@/lib/hooks/useQuery'
import useEventService, { EventService } from './event-edit/useEventService'
import SearchResults from '@/calendar/SearchResults'

import { GlobalEvent } from '@/util/global'
import useKeyPress from '@/lib/hooks/useKeyPress'

import { ChronoUnit, ZonedDateTime as DateTime } from '@js-joda/core'
import * as dates from '@/util/dates-joda'
import { firstDayOfWeek } from '@/util/localizer-joda'

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
import TimezoneChangePrompt from './TimezoneChangePrompt'

import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import { eventsState, editingEventState, allVisibleEventsSelector } from '@/state/EventsState'
import { calendarViewState, calendarViewStateUserTimezone } from '@/state/CalendarViewState'

/**
 * The main calendar component. This is the top level component for the calendar.
 *
 * It uses the timezone from the user's settings to display the calendar in the user's
 * local timezone.
 *
 */
function Calendar() {
  const eventService: EventService = useEventService()

  const calendars = useRecoilValue(calendarsState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const events = useRecoilValue(eventsState)
  const editingEvent = useRecoilValue(editingEventState)
  const allVisibleEvents = useRecoilValue(allVisibleEventsSelector)

  const [calendarView, setCalendarView] = useRecoilState(calendarViewState)
  const calendarViewUserTimezone = useRecoilValue(calendarViewStateUserTimezone)

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

  /**
   * Load events for the current view.
   */
  useEffect(() => {
    // Aborts any pending requests after the component is unmounted.
    const controller = new AbortController()
    const { signal } = controller

    loadCurrentViewEvents(signal)

    return () => {
      controller.abort()
    }
  }, [calendarView.view, calendarViewUserTimezone, calendars.calendarsById, refreshId])

  /**
   * Update the time atom every 2 minutes.
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCalendarView((state) => ({ ...state, now: DateTime.now() }))
    }, 60000 * 2)

    return () => clearInterval(intervalId) // Clear interval on component unmount
  }, [])

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
        const prevDay = dates.subtract(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.DAYS)
        setCalendarView((state) => ({ ...state, selectedDate: prevDay }))

        // setDisplay((state) => ({ ...state, selectedDate: prevDay }))
      } else if (e.key === 'ArrowRight') {
        const nextDay = dates.add(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.DAYS)
        setCalendarView((state) => ({ ...state, selectedDate: nextDay }))
      }
    } else if (calendarView.view == 'Week' || calendarView.view == 'WorkWeek') {
      if (e.key === 'ArrowLeft') {
        const prevWeek = dates.subtract(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.WEEKS)
        setCalendarView((state) => ({ ...state, selectedDate: prevWeek }))
      } else if (e.key === 'ArrowRight') {
        const nextWeek = dates.add(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.WEEKS)
        setCalendarView((state) => ({ ...state, selectedDate: nextWeek }))
      }
    } else if (calendarView.view == 'Month') {
      if (e.key === 'ArrowLeft') {
        const prevMonth = dates.subtract(
          calendarViewUserTimezone.selectedDate,
          1,
          ChronoUnit.MONTHS
        )
        setCalendarView((state) => ({ ...state, selectedDate: prevMonth }))
      } else if (e.key === 'ArrowRight') {
        const nextMonth = dates.add(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.MONTHS)
        setCalendarView((state) => ({ ...state, selectedDate: nextMonth }))
      }
    }
  }

  async function loadCurrentViewEvents(signal: AbortSignal) {
    if (calendarView.view == 'Day') {
      const start = dates.startOf(calendarViewUserTimezone.selectedDate, ChronoUnit.DAYS)
      const end = dates.endOf(calendarViewUserTimezone.selectedDate, ChronoUnit.DAYS)

      eventService.loadAllEvents(start, end, signal)
    } else if (calendarView.view == 'Week' || calendarView.view == 'WorkWeek') {
      const lastWeek = dates.subtract(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.WEEKS)
      const nextWeek = dates.add(calendarViewUserTimezone.selectedDate, 1, ChronoUnit.WEEKS)

      const start = dates.startOfWeek(lastWeek, firstOfWeek)
      const end = dates.endOfWeek(nextWeek, firstOfWeek)

      eventService.loadAllEvents(start, end, signal)
    } else if (calendarView.view == 'Month') {
      const month = dates.visibleDays(calendarViewUserTimezone.selectedDate, firstOfWeek)
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
          now={calendarViewUserTimezone.selectedDate}
          events={allVisibleEvents}
          range={[calendarViewUserTimezone.selectedDate]}
          primaryCalendar={primaryCalendar}
          today={today}
        />
      )
    } else if (calendarView.view == 'Week') {
      return (
        <Week
          now={calendarViewUserTimezone.now}
          date={calendarViewUserTimezone.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
          today={today}
        />
      )
    } else if (calendarView.view == 'WorkWeek') {
      return (
        <WorkWeek
          date={calendarViewUserTimezone.selectedDate}
          events={allVisibleEvents}
          eventService={eventService}
          primaryCalendar={primaryCalendar}
          now={calendarViewUserTimezone.now}
          today={today}
        />
      )
    } else if (calendarView.view == 'Month') {
      return (
        <Month
          now={calendarViewUserTimezone.now}
          loading={events.loading}
          date={calendarViewUserTimezone.selectedDate}
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
      return <EventEditFull eventService={eventService} editingEvent={editingEvent} />
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
              editingEvent={editingEvent}
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
    <Box
      flex="1 1 auto"
      boxSizing="border-box"
      height="100%"
      display="flex"
      flexDirection="column"
      alignItems="stretch"
      className="cal-calendar"
    >
      {renderCalendar()}
      {renderFullEditMode()}
      {renderConfirmationDialog()}
      <TimezoneChangePrompt />
    </Box>
  )
}

export default Calendar
