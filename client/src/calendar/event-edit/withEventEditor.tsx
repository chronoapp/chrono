import React from 'react'
import { Subtract } from 'utility-types'
import { FiCheck, FiTrash } from 'react-icons/fi'

import { GlobalEvent } from '../../util/global'
import { getAuthToken, createEvent, updateEvent, deleteEvent } from '../../util/Api'
import Event from '../../models/Event'
import Alert from '../../models/Alert'

import { EventActionContext, EventActionContextType } from '../EventActionContext'
import { AlertsContext, AlertsContextType } from '../../components/AlertsContext'

export interface InjectedEventEditProps {
  onSaveEvent: (e: Event) => void
  onDeleteEvent: (eventId: number) => void
}

/**
 * Provides CRUD Actions that deal with the event API and injects:
 * - onSaveEvent
 * - onDeleteEvent
 *
 * @param WrappedComponent
 */
function withEventEditor<P extends InjectedEventEditProps>(
  WrappedComponent: React.ComponentType<P>
) {
  function onDeleteEvent(
    eventId: number,
    eventActions: EventActionContextType,
    alertsContext: AlertsContextType
  ) {
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
    eventActions.eventDispatch({
      type: 'DELETE_EVENT',
      payload: { eventId: eventId },
    })
    const token = getAuthToken()

    const savingAlert = new Alert({ title: 'Deleting Event..', isLoading: true })
    alertsContext.addAlert(savingAlert)
    deleteEvent(token, eventId).then(() => {
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

  /**
   * Syncs the event to the server.
   */
  function onSaveEvent(
    event: Event,
    eventActions: EventActionContextType,
    alertsContext: AlertsContextType
  ) {
    const token = getAuthToken()
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })

    const savingAlert = new Alert({ title: 'Saving Event..', isLoading: true })
    alertsContext.addAlert(savingAlert)

    const isExistingEvent = event.id !== -1
    if (isExistingEvent) {
      eventActions.eventDispatch({
        type: 'UPDATE_EVENT',
        payload: { event: event, replaceEventId: event.id },
      })

      updateEvent(token, event)
        .then((event) => {
          eventActions.eventDispatch({
            type: 'UPDATE_EVENT',
            payload: { event, replaceEventId: -1 },
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
        eventActions.eventDispatch({
          type: 'UPDATE_EVENT',
          payload: { event, replaceEventId: -1 },
        })
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

  return class WithEventEditor extends React.Component<Subtract<P, InjectedEventEditProps>, {}> {
    render() {
      return (
        <AlertsContext.Consumer>
          {(alertsContext) => (
            <EventActionContext.Consumer>
              {(eventActions) => (
                <WrappedComponent
                  {...(this.props as P)}
                  onSaveEvent={(event) => onSaveEvent(event, eventActions, alertsContext)}
                  onDeleteEvent={(event) => onDeleteEvent(event, eventActions, alertsContext)}
                />
              )}
            </EventActionContext.Consumer>
          )}
        </AlertsContext.Consumer>
      )
    }
  }
}

export default withEventEditor
