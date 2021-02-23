import React from 'react'
import { FiCheck, FiTrash } from 'react-icons/fi'

import { GlobalEvent } from '../../util/global'
import {
  getAuthToken,
  createEvent,
  updateEvent as updateEventReq,
  deleteEvent as deleteEventReq,
} from '../../util/Api'
import Event, { UNSAVED_EVENT_ID } from '../../models/Event'
import Alert from '../../models/Alert'

import { EventActionContext, DeleteMethod } from '../EventActionContext'
import { AlertsContext } from '@/contexts/AlertsContext'

/**
 * Hook to provides CRUD Action that deal with the event server API.
 * and creates UI Alerts on updates.
 */
export default function useEventService() {
  const alertsContext = React.useContext(AlertsContext)
  const eventActions = React.useContext(EventActionContext)

  function deleteEvent(eventId: string, deleteMethod: DeleteMethod = 'SINGLE') {
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
    eventActions.eventDispatch({
      type: 'DELETE_EVENT',
      payload: { eventId, deleteMethod },
    })
    const token = getAuthToken()

    const savingAlert = new Alert({ title: 'Deleting Event..', isLoading: true })
    alertsContext.addAlert(savingAlert)

    deleteEventReq(token, eventId).then(() => {
      alertsContext.addAlert(
        new Alert({
          title: 'Event Deleted',
          icon: FiTrash,
          autoDismiss: true,
          removeAlertId: savingAlert.id,
        })
      )
    })
  }

  function updateEvent(event: Event) {
    // Update the the editing event copy.
    if (event.id === eventActions.eventState.editingEvent?.id) {
      eventActions.eventDispatch({
        type: 'UPDATE_EDIT_EVENT',
        payload: event,
      })
    }

    if (event.id !== UNSAVED_EVENT_ID) {
      const alert = new Alert({ title: 'Saving Event..', isLoading: true })
      alertsContext.addAlert(alert)

      // TODO: Queue overrides from server to prevent race condition.
      updateEventReq(getAuthToken(), event)
        .then(() => {
          alertsContext.addAlert(
            new Alert({
              title: 'Event Updated.',
              icon: FiCheck,
              removeAlertId: alert.id,
              autoDismiss: true,
            })
          )
        })
        .catch((err) => {
          // TODO: Revert to Original
        })
    }
  }

  function saveEvent(event: Event) {
    const token = getAuthToken()
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })

    const savingAlert = new Alert({ title: 'Saving Event..', isLoading: true })
    alertsContext.addAlert(savingAlert)

    const isExistingEvent = event.id !== UNSAVED_EVENT_ID
    if (isExistingEvent) {
      eventActions.eventDispatch({
        type: 'UPDATE_EVENT',
        payload: { event: event, replaceEventId: event.id },
      })

      updateEventReq(token, event)
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

          alertsContext.addAlert(
            new Alert({
              title: 'Event Updated.',
              icon: FiCheck,
              autoDismiss: true,
              removeAlertId: savingAlert.id,
            })
          )
        })
    } else {
      eventActions.eventDispatch({ type: 'CREATE_EVENT', payload: event })
      createEvent(token, event).then((event) => {
        console.log(`Created event in db: ${event.id}`)

        if (event.recurrences) {
          document.dispatchEvent(new CustomEvent(GlobalEvent.refreshCalendar))
        } else {
          eventActions.eventDispatch({
            type: 'UPDATE_EVENT',
            payload: { event, replaceEventId: UNSAVED_EVENT_ID },
          })
        }

        alertsContext.addAlert(
          new Alert({
            title: 'Event Created.',
            icon: FiCheck,
            autoDismiss: true,
            removeAlertId: savingAlert.id,
          })
        )
      })
    }
  }

  return { saveEvent, deleteEvent, updateEvent }
}
