import React from 'react'
import { FiCheck, FiTrash } from 'react-icons/fi'
import { useToast } from '@chakra-ui/react'
import { GlobalEvent } from '@/util/global'

import * as API from '@/util/Api'
import Event from '@/models/Event'
import Toast from '@/components/Toast'

import { EventActionContext, EditRecurringAction } from '../EventActionContext'
import useTaskQueue from '@/lib/hooks/useTaskQueue'

export type EventService = {
  saveEvent: (event: Event, showToast?: boolean) => void
  updateEvent: (event: Partial<Event>, showToast?: boolean) => void
  deleteEvent: (calendarId: string, eventId: string, deleteMethod?: EditRecurringAction) => void
}

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
 */
export default function useEventService(): EventService {
  const eventActions = React.useContext(EventActionContext)
  const toast = useToast({ duration: 2000, position: 'top' })
  const currentToastId = React.useRef<string | number | undefined>()

  const createdEventIdsRef = React.useRef<Record<string, string>>({})
  const taskQueue = useTaskQueue({ shouldProcess: true })

  function deleteEvent(
    calendarId: string,
    eventId: string,
    deleteMethod: EditRecurringAction = 'SINGLE'
  ) {
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
    eventActions.eventDispatch({
      type: 'DELETE_EVENT',
      payload: { calendarId, eventId, deleteMethod },
    })
    queueDeleteEvent(calendarId, eventId)
  }

  /**
   * Update an existing event and handles updating the recurrence for a parent event.
   * Use instead of saveEvent when the event hasn't been synced to server yet.
   *
   */
  function updateEvent(event: Partial<Event>, showToast: boolean = true) {
    if (!event.id) {
      throw new Error('updateEvent: event does not have id')
    }

    const calendarId = event.calendar_id!

    // For recurring events, delete all and refresh.
    // TODO: Add a filter for updates and deletes to the client store
    // so we don't need a full refresh and prevent flickering.
    if (Event.isParentRecurringEvent(event)) {
      eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
      eventActions.eventDispatch({
        type: 'DELETE_EVENT',
        payload: { calendarId: calendarId, eventId: event.id, deleteMethod: 'ALL' },
      })
    }

    // Update the the editing event copy.
    if (event.id === eventActions.eventState.editingEvent?.id) {
      eventActions.eventDispatch({
        type: 'UPDATE_EDIT_EVENT',
        payload: event,
      })
    }

    queueUpdateEvent(calendarId, event, !!event.synced)
  }

  /**
   * Saves a new event to the server.
   *
   * Optimistically creates the event in the UI before sending the API
   * requests in a queue.
   *
   * @param event Event to Create / Update
   * @returns a promise of the updated event.
   */
  function saveEvent(event: Event, showToast: boolean = true) {
    const calendarId = event.calendar_id
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })

    const { editingEvent } = eventActions.eventState

    if (event.synced) {
      if (editingEvent?.originalCalendarId && editingEvent.originalCalendarId !== calendarId) {
        console.log(`Moved calendars from ${editingEvent.originalCalendarId} to ${calendarId}`)
        eventActions.eventDispatch({
          type: 'MOVE_EVENT_CALENDAR',
          payload: {
            prevCalendarId: editingEvent.originalCalendarId,
            newCalendarId: calendarId,
            eventId: event.id,
          },
        })

        queueMoveEvent(event.id, editingEvent.originalCalendarId, calendarId)
      }

      console.log(`Save Event update UI: ${event.title}`)
      eventActions.eventDispatch({
        type: 'UPDATE_EVENT',
        payload: { calendarId, event: event, replaceEventId: event.id },
      })

      queueUpdateEvent(calendarId, event, showToast)
    } else {
      eventActions.eventDispatch({ type: 'CREATE_EVENT', payload: event })
      queueCreateEvent(calendarId, event, showToast)
    }
  }

  /**
   * Queues API request to create an event.
   */
  function queueCreateEvent(calendarId: string, event: Event, showToast: boolean) {
    const token = API.getAuthToken()
    const tempEventId = event.id

    if (showToast) {
      currentToastId.current = toast({
        render: (props) => <Toast title={'Saving Event..'} showSpinner={true} {...props} />,
      })
    }

    const createEventTask = () => {
      console.log(`RUN createEventTask ${event.title}...`)

      return API.createEvent(token, calendarId, event)
        .then((event) => {
          console.log(`Created event id=${event.id}`)

          if (event.recurrences) {
            document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
          } else {
            eventActions.eventDispatch({
              type: 'UPDATE_EVENT_ID',
              payload: { calendarId, prevEventId: tempEventId, newEventId: event.id },
            })
          }

          // Maintain a map between IDs we've created client side with the
          // stable ID from the server.
          createdEventIdsRef.current = {
            ...createdEventIdsRef.current,
            [tempEventId]: event.id,
          }

          if (currentToastId.current) {
            toast.close(currentToastId.current)
          }
          if (showToast) {
            currentToastId.current = toast({
              render: (props) => (
                <Toast title={'Event Created.'} showSpinner={false} {...props} Icon={FiCheck} />
              ),
            })
          }
        })
        .catch((err) => {
          // Refresh on error
          document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
        })
    }

    console.log(`QUEUE createEventTask id=${event.id} ---`)
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
  function queueUpdateEvent(calendarId: string, event: Partial<Event>, showToast: boolean) {
    const token = API.getAuthToken()

    if (showToast) {
      currentToastId.current = toast({
        render: (props) => <Toast title={'Saving Event..'} showSpinner={true} {...props} />,
      })
    }

    const updateEventTask = () => {
      console.log(`RUN updateEventTask ${event.title}..`)

      const createdEventIds = createdEventIdsRef.current
      let serverEventId: string | undefined = undefined
      if (event.synced) {
        serverEventId = event.id
      } else if (event.id && createdEventIds.hasOwnProperty(event.id)) {
        serverEventId = createdEventIds[event.id]
      }

      console.log(createdEventIds)
      console.log(serverEventId)

      // Skip if this event hasn't been saved to the server.
      // => We can't created it yet,
      if (!serverEventId) {
        console.log('Skip update event')
        return Promise.resolve()
      }

      return API.updateEvent(token, calendarId, { ...event, id: serverEventId }).then((event) => {
        console.log(`Updated Event id=${event.id}.`)

        // Recurring event: TODO: Only refresh if moved calendar.
        if (Event.isParentRecurringEvent(event)) {
          document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
        }

        if (currentToastId.current) {
          toast.close(currentToastId.current)
        }
        if (showToast) {
          currentToastId.current = toast({
            render: (props) => (
              <Toast title={'Event Updated.'} showSpinner={false} {...props} Icon={FiCheck} />
            ),
          })
        }
      })
    }

    console.log(`QUEUE updateEventTask ${event.id}`)
    taskQueue.addTask(updateEventTask)
  }

  /**
   * Moves an event from one calendar to another.
   */
  function queueMoveEvent(eventId: string, fromCalendarId: string, toCalendarId: string) {
    const moveEventTask = () => {
      console.log(`Moving event ${eventId} from ${fromCalendarId} to ${toCalendarId}`)

      return API.moveEvent(API.getAuthToken(), eventId, fromCalendarId, toCalendarId).then((e) => {
        console.log(`Moved event ${e.id}`)
      })
    }

    taskQueue.addTask(moveEventTask)
  }

  /**
   * Removes an event from the calendar.
   */
  function queueDeleteEvent(calendarId: string, eventId: string) {
    const toastId = toast({
      render: (props) => <Toast title={'Deleting Event..'} showSpinner={true} {...props} />,
    })

    const deleteEventTask = () =>
      API.deleteEvent(API.getAuthToken(), calendarId, eventId).then(() => {
        toastId && toast.close(toastId)
        toast({
          render: (props) => (
            <Toast title={'Event Deleted.'} showSpinner={false} {...props} Icon={FiTrash} />
          ),
        })
      })

    taskQueue.addTask(deleteEventTask)
  }

  return { saveEvent, deleteEvent, updateEvent }
}
