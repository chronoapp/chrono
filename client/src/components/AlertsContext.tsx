import React, { createContext, useState } from 'react'
import Alert from '../models/Alert'
import { mdiCheck, mdiDelete } from '@mdi/js'

type AlertType = 'UPDATED_EVENT' | 'DELETED_EVENT' | 'CREATED_EVENT'

export interface AlertsContextType {
  addMessage: (message: string) => void
  addAlert: (alertType: AlertType) => void
  removeAlert: () => void
  alert: Alert
}

export const AlertsContext = createContext<AlertsContextType>(undefined!)

/**
 * Global event notifications.
 * TODO: Display in progress notifications.
 * TODO: Use a queue instead.
 */
export function AlertsContextProvider(props: any) {
  const [alert, setAlert] = useState<Alert>(undefined!)

  function removeAlert() {
    setAlert(undefined!)
  }

  const defaultContext = {
    addMessage: function (message: string) {
      setAlert(new Alert(message, undefined))
      setTimeout(removeAlert, 3000)
    },
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
