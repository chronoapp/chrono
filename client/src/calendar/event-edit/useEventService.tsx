import React from 'react'
import { produce } from 'immer'
import { useRecoilState } from 'recoil'

import { useToast } from '@chakra-ui/react'
import { GlobalEvent } from '@/util/global'
import { InfoAlert } from '@/components/Alert'

import * as API from '@/util/Api'
import Event from '@/models/Event'
import * as dates from '@/util/dates'

import { getSplitRRules } from '@/calendar/utils/RecurrenceUtils'
import {
  eventsState,
  EditRecurringAction,
  editingEventState,
  EventUpdateContext,
} from '@/state/EventsState'
import useEventActions from '@/state/useEventActions'
import useTaskQueue from '@/lib/hooks/useTaskQueue'

/**
 * Hook to provides CRUD Action that deal with the event server API.
 * and creates UI Alerts on updates.
 *
 * We use queues for API requests because of the sequence:
 * 1) Create event (UI update) + queue create API request
 * 2) Update event (UI update) + queue update API request
 * 3) Create event response
 * 4) Update event response
 *
 * At (2), we don't have the ID from the server yet, so we can't
 * perform an update request. By using a queue, we can map the ID
 * from (1), and use it to update the event.
 *
 * TODO: Simplify this API using a client-generated ID.
 *
 */
export default function useEventService() {
  const [events, setEvents] = useRecoilState(eventsState)

  const [editingEvent, setEditingEvent] = useRecoilState(editingEventState)
  const eventActions = useEventActions()

  const toast = useToast()
  const taskQueue = useTaskQueue({ shouldProcess: true })

  /**
   * Handles updating an event via drag or resize.
   *
   * 1) The event is a recurring event or has participants, it will show a confirmation dialog.
   * 2) The event is not synced to the server yet, it will update the event locally.
   * 3) The event is synced to the server, it will save the event.
   */
  function moveOrResizeEvent(event: Event) {
    const hasParticipants = Event.hasNonOrganizerParticipants(event)
    const isRecurringEvent = event.recurring_event_id !== null
    const showConfirmDialog = event.syncStatus == 'SYNCED' && (hasParticipants || isRecurringEvent)

    if (showConfirmDialog) {
      const updateContext = {
        eventEditAction: 'UPDATE',
        isRecurringEvent: event.recurring_event_id !== null,
        hasParticipants: hasParticipants,
      } as EventUpdateContext

      eventActions.showConfirmDialog(updateContext, event, 'MOVE_RESIZE')
    } else {
      if (event.syncStatus === 'NOT_SYNCED') {
        updateEventLocal(event)
      } else {
        saveEvent(event)
      }
    }
  }

  /**
   * Update an existing (editing) event. Use instead of saveEvent when
   * the event hasn't been synced to server yet so we don't make an API
   * request yet.
   */
  function updateEventLocal(event: Event) {
    if (!event.id) {
      throw new Error('updateEvent: event does not have id')
    }

    const calendarId = event.calendar_id!

    // Update the the editing event copy.
    if (event.id === editingEvent?.id) {
      eventActions.updateEditingEvent(event)
    } else {
      eventActions.updateEvent(calendarId, event.id, event)
    }
  }

  /**
   * Saves a new event to the server.
   *
   * Optimistically creates the event in the UI before sending the API
   * requests in a queue.
   *
   * @param event Event to Create / Update
   * @param sendUpdates Whether to send updates to participants.
   * @param showToast Whether to show a toast message.
   * @param resetEditingEvent Whether to reset the editing event.
   *
   * @returns a promise of the updated event.
   */
  function saveEvent(
    event: Event,
    sendUpdates: boolean = true,
    showToast: boolean = true,
    resetEditingEvent: boolean = true
  ) {
    const calendarId = event.calendar_id
    if (resetEditingEvent) {
      setEditingEvent(null)
    }

    if (event.syncStatus === 'NOT_SYNCED') {
      setEvents((prevState) => {
        return {
          ...prevState,
          eventsByCalendar: produce(prevState.eventsByCalendar, (draft) => {
            draft[calendarId][event.id] = { ...event, syncStatus: 'SYNCING' }
          }),
        }
      })
      queueCreateEvent(calendarId, event, showToast, sendUpdates)
    } else {
      const hasMovedCalendar =
        editingEvent?.originalCalendarId && editingEvent.originalCalendarId !== calendarId
      if (hasMovedCalendar && editingEvent?.originalCalendarId) {
        console.log(`Moved calendars from ${editingEvent.originalCalendarId} to ${calendarId}`)
        eventActions.moveEventCalendarAction(event.id, editingEvent.originalCalendarId, calendarId)
        queueMoveEvent(event.id, editingEvent.originalCalendarId, calendarId, sendUpdates)
      }

      eventActions.updateEvent(calendarId, event.id, event)
      queueUpdateEvent(calendarId, event, false, sendUpdates)
    }
  }

  function deleteEvent(
    calendarId: string,
    eventId: string,
    deleteMethod: EditRecurringAction,
    sendUpdates: boolean
  ) {
    setEditingEvent(null)
    eventActions.deleteEvent(calendarId, eventId, deleteMethod)
    queueDeleteEvent(calendarId, eventId, sendUpdates)
  }

  function deleteAllRecurringEvents(calendarId: string, eventId: string, sendUpdates: boolean) {
    setEditingEvent(null)
    eventActions.deleteEvent(calendarId, eventId, 'ALL')
    queueDeleteEvent(calendarId, eventId, sendUpdates)
  }

  /**
   * This changes the parent event's recurrences to cut off at the current event's original start date.
   */
  async function deleteThisAndFollowingEvents(event: Event, sendUpdates: boolean) {
    if (!event.recurrences || !event.recurring_event_id || !event.original_start) {
      throw Error('Invalid Recurring Event')
    }
    const calendarId = event.calendar_id
    const parentEvent = await API.getEvent(calendarId, event.recurring_event_id)

    const rules = getSplitRRules(
      event.recurrences!.join('\n'),
      parentEvent.start,
      event.original_start,
      event.start,
      parentEvent.all_day
    )

    const updatedParentEvent = { ...parentEvent, recurrences: [rules.start.toString()] }

    // Optimistic UI Update.
    eventActions.cancelSelect()
    const eventsToDelete = Object.values(events.eventsByCalendar[calendarId]).filter((e) => {
      return (
        e.recurring_event_id == parentEvent.id &&
        e.original_start &&
        event.original_start &&
        dates.gte(e.original_start, event.original_start)
      )
    })

    for (const deleteEvent of eventsToDelete) {
      eventActions.deleteEvent(calendarId, deleteEvent.id, 'SINGLE')
    }

    queueUpdateEvent(calendarId, updatedParentEvent, true, sendUpdates)
  }

  /**
   * Queues API request to create an event.
   */
  function queueCreateEvent(
    calendarId: string,
    event: Event,
    showToast: boolean,
    sendUpdates: boolean
  ) {
    const createEventTask = () => {
      console.log(`RUN createEventTask id=${event.id} ${event.title}...`)

      return API.createEvent(calendarId, event, sendUpdates)
        .then((event) => {
          console.log(`Created event id=${event.id}`)

          if (event.recurrences) {
            document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
          } else {
            eventActions.onSavedEventToServer(calendarId, event.id)
          }

          if (showToast) {
            toast({
              render: (p) => {
                return <InfoAlert onClose={p.onClose} title="Event created." />
              },
            })
          }
        })
        .catch((err) => {
          // Refresh on error
          document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
        })
    }

    taskQueue.addTask(createEventTask)
  }

  /**
   * Makes an API request to update the event in a queue.
   * This makes sure that event updates are sequential.
   *
   * If the event hasn't been synced to the server, we don't send an update request.
   * That means an editing event was dragged and dropped.
   *
   */
  function queueUpdateEvent(
    calendarId: string,
    event: Partial<Event>,
    showToast: boolean,
    sendUpdates: boolean
  ) {
    const updateEventTask = () => {
      console.log(`RUN updateEventTask ${event.title}..`)

      return API.updateEvent(calendarId, event, sendUpdates).then((event) => {
        // Recurring event: TODO: Only refresh if moved calendar.
        if (Event.isParentRecurringEvent(event)) {
          document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
        }

        if (showToast) {
          toast({
            render: (p) => {
              return <InfoAlert onClose={p.onClose} title="Event updated." />
            },
          })
        }
      })
    }

    taskQueue.addTask(updateEventTask)
  }

  /**
   * Moves an event from one calendar to another.
   */
  function queueMoveEvent(
    eventId: string,
    fromCalendarId: string,
    toCalendarId: string,
    sendUpdates: boolean
  ) {
    const moveEventTask = () => {
      console.log(`Moving event ${eventId} from ${fromCalendarId} to ${toCalendarId}`)

      return API.moveEvent(eventId, fromCalendarId, toCalendarId, sendUpdates).then((e) => {
        console.log(`Moved event ${e.id}`)
      })
    }

    taskQueue.addTask(moveEventTask)
  }

  /**
   * Removes an event from the calendar.
   */
  function queueDeleteEvent(calendarId: string, eventId: string, sendUpdates: boolean) {
    const deleteEventTask = () =>
      API.deleteEvent(calendarId, eventId, sendUpdates).then(() => {
        toast({
          render: (p) => {
            return <InfoAlert onClose={p.onClose} title="Event deleted." />
          },
        })
      })

    taskQueue.addTask(deleteEventTask)
  }

  return {
    saveEvent,
    moveOrResizeEvent,
    deleteEvent,
    deleteThisAndFollowingEvents,
    deleteAllRecurringEvents,
  }
}

export type EventService = ReturnType<typeof useEventService>
