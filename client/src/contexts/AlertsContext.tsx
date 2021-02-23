import React, { createContext, useState, useRef } from 'react'
import update from 'immutability-helper'
import Alert from '@/models/Alert'

export interface AlertsContextType {
  addMessage: (message: string) => void
  addAlert: (alert: Alert) => void
  removeAlert: (alert: Alert) => void
  getAlert: () => Alert | undefined
}

export const AlertsContext = createContext<AlertsContextType>(undefined!)

/**
 * Global event notifications.
 * TODO: Display in progress notifications.
 * TODO: Use a queue instead / better way to remove alerts.
 */
export function AlertsContextProvider(props: any) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const ref = useRef(alerts)

  function updateAlerts(alerts: Alert[]) {
    ref.current = alerts
    setAlerts(alerts)
  }

  function removeAlert(alert: Alert) {
    const delIdx = ref.current.map((a) => a.id).indexOf(alert.id)
    if (delIdx != -1) {
      updateAlerts(update(ref.current, { $splice: [[delIdx, 1]] }))
    }
  }

  function appendAlert(alert: Alert) {
    const updated = update(ref.current, { $push: [alert] })
    updateAlerts(updated)

    if (alert.autoDismiss) {
      setTimeout(() => removeAlert(alert), 3000)
    }
    if (alert.removeAlertId) {
      const rmAlert = ref.current.find((a) => a.id == alert.removeAlertId)
      if (rmAlert) {
        removeAlert(rmAlert)
      }
    } else {
      if (ref.current.length > 1) {
        removeAlert(ref.current[0])
      }
    }
  }

  const defaultContext = {
    getAlert: function () {
      return ref.current.length > 0 ? ref.current[0] : undefined
    },
    addMessage: function (message: string) {
      const alert = new Alert({ title: message, autoDismiss: true })
      appendAlert(alert)
    },
    addAlert: function (alert: Alert) {
      appendAlert(alert)
    },
    removeAlert,
  }

  return <AlertsContext.Provider value={defaultContext}>{props.children}</AlertsContext.Provider>
}
