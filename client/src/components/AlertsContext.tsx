import React, { createContext, useState } from 'react'
import Alert from '../models/Alert'

export interface AlertsContextType {
  addMessage: (message: string) => void
  addAlert: (alert: Alert) => void
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
    addAlert: function (alert: Alert) {
      setAlert(alert)
      setTimeout(removeAlert, 3000)
    },
    removeAlert,
    alert,
  }

  return <AlertsContext.Provider value={defaultContext}>{props.children}</AlertsContext.Provider>
}
