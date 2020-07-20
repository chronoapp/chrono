import React, { createContext, useState } from 'react'
import Alert from '../models/Alert'
import { mdiCheck, mdiDelete } from '@mdi/js'

type AlertType = 'UPDATED_EVENT' | 'DELETED_EVENT' | 'CREATED_EVENT'

export interface AlertsContextType {
  addAlert: (alertType: AlertType) => void
  removeAlert: () => void
  alert: Alert
}

export const AlertsContext = createContext<AlertsContextType>(undefined!)

/**
 * Global event notifications.
 * TODO: Display in progress notifications.
 * TODO: Could this use a global pub/sub instead of react context? This prevents the need to
 * include AlertsContext.consumer in all components that need to display a message.
 *
 */
export function AlertsContextProvider(props: any) {
  const [alert, setAlert] = useState<Alert>()

  function removeAlert() {
    setAlert(undefined)
  }

  const defaultContext = {
    addAlert: function (alertType: AlertType) {
      switch (alertType) {
        case 'UPDATED_EVENT':
          setAlert(new Alert('Updated event.', mdiCheck))
          break
        case 'DELETED_EVENT':
          setAlert(new Alert('Deleted event.', mdiDelete))
          break
        case 'CREATED_EVENT':
          setAlert(new Alert('Created event.', mdiCheck))
          break
        default:
          throw new Error('Invalid alert type')
      }
      setTimeout(removeAlert, 3000)
    },
    removeAlert,
    alert,
  }

  return <AlertsContext.Provider value={defaultContext}>{props.children}</AlertsContext.Provider>
}
