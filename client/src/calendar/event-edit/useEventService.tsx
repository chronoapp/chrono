import React from 'react'
import { FiCheck, FiTrash } from 'react-icons/fi'
import { useToast } from '@chakra-ui/react'

import { GlobalEvent } from '@/util/global'
import {
  getAuthToken,
  createEvent,
  updateEvent as updateEventReq,
  deleteEvent as deleteEventReq,
} from '@/util/Api'
import Event, { UNSAVED_EVENT_ID } from '@/models/Event'
import Toast from '@/components/Toast'

import { EventActionContext, EditRecurringAction } from '../EventActionContext'

/**
 * Hook to provides CRUD Action that deal with the event server API.
 * and creates UI Alerts on updates.
 */
export default function useEventService() {
  const eventActions = React.useContext(EventActionContext)
  const toast = useToast({ duration: 2000, position: 'top' })

  function deleteEvent(eventId: string, deleteMethod: EditRecurringAction = 'SINGLE') {
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
    eventActions.eventDispatch({
      type: 'DELETE_EVENT',
      payload: { eventId, deleteMethod },
    })
    const token = getAuthToken()

    const toastId = toast({
      render: (props) => <Toast title={'Deleting Event..'} showSpinner={true} {...props} />,
    })

    deleteEventReq(token, eventId).then(() => {
      toastId && toast.close(toastId)
      toast({
        render: (props) => (
          <Toast title={'Event Deleted.'} showSpinner={false} {...props} Icon={FiTrash} />
        ),
      })
    })
  }

  /**
   * Update an existing event and handles updating the recurrence for a parent event.
   */
  function updateEvent(event: Partial<Event>, showToast: boolean = true) {
    if (!event.id) {
      throw new Error('updateEvent: event does not have id')
    }

    // Update the the editing event copy.
    if (event.id === eventActions.eventState.editingEvent?.id) {
      eventActions.eventDispatch({
        type: 'UPDATE_EDIT_EVENT',
        payload: event,
      })
    }

    // For recurring events, delete all and refresh.
    // TODO: Add a filter for updates and deletes to the client store
    // so we don't need a full refresh and prevent flickering.
    if (Event.isParentRecurringEvent(event)) {
      eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
      eventActions.eventDispatch({
        type: 'DELETE_EVENT',
        payload: { eventId: event.id, deleteMethod: 'ALL' },
      })
    }

    if (event.id !== UNSAVED_EVENT_ID) {
      const toastId =
        showToast &&
        toast({
          render: (props) => <Toast title={'Saving Event..'} showSpinner={true} {...props} />,
        })

      // TODO: Queue overrides from server to prevent race condition.
      return updateEventReq(getAuthToken(), event)
        .then((event) => {
          if (Event.isParentRecurringEvent(event)) {
            document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
          }

          toastId && toast.close(toastId)
          showToast &&
            toast({
              render: (props) => (
                <Toast title={'Event Updated.'} showSpinner={false} {...props} Icon={FiCheck} />
              ),
            })
        })
        .catch((err) => {
          // TODO: Revert to Original
        })
    }
  }

  /**
   * Saves a new event to the server.
   *
   * @param event Event to Create / Update
   * @returns a promise of the updated event.
   */
  function saveEvent(event: Event, showToast: boolean = true) {
    const token = getAuthToken()
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })

    const toastId =
      showToast &&
      toast({
        render: (props) => <Toast title={'Saving Event..'} showSpinner={true} {...props} />,
      })

    const isExistingEvent = event.id !== UNSAVED_EVENT_ID
    if (isExistingEvent) {
      eventActions.eventDispatch({
        type: 'UPDATE_EVENT',
        payload: { event: event, replaceEventId: event.id },
      })

      return updateEventReq(token, event)
        .then((event) => {
          eventActions.eventDispatch({
            type: 'UPDATE_EVENT',
            payload: { event, replaceEventId: UNSAVED_EVENT_ID },
          })

          return event
        })
        .then((event) => {
          // Recurring event: TODO: Only refresh if moved calendar.
          if (event.recurring_event_id != null) {
            document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
          }

          toastId && toast.close(toastId)
          showToast &&
            toast({
              render: (props) => (
                <Toast title={'Event Updated.'} showSpinner={false} {...props} Icon={FiCheck} />
              ),
            })
        })
    } else {
      eventActions.eventDispatch({ type: 'CREATE_EVENT', payload: event })
      return createEvent(token, event).then((event) => {
        console.log(`Created event in db: ${event.id}`)

        if (event.recurrences) {
          document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
        } else {
          eventActions.eventDispatch({
            type: 'UPDATE_EVENT',
            payload: { event, replaceEventId: UNSAVED_EVENT_ID },
          })
        }

        toastId && toast.close(toastId)
        showToast &&
          toast({
            render: (props) => (
              <Toast title={'Event Created.'} showSpinner={false} {...props} Icon={FiCheck} />
            ),
          })
      })
    }
  }

  return { saveEvent, deleteEvent, updateEvent }
}
