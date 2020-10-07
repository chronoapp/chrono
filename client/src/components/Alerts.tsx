import React, { useContext } from 'react'
import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'
import CircularProgress from '@material-ui/core/CircularProgress'

import { AlertsContext } from '../components/AlertsContext'

export function Alerts() {
  const alertContext = useContext(AlertsContext)
  const alert = alertContext.getAlert()

  return (
    <div className="global-alert">
      {alert && (
        <span className="tag is-medium has-background-grey has-text-white-bis">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {alert.isLoading && (
              <CircularProgress size={'1rem'} className="mr-1 has-text-white-ter" />
            )}
            {alert.iconType && (
              <Icon path={alert.iconType} size={0.7} className="has-text-grey-light mr-1" />
            )}
            {alert.title}
          </div>
          <div style={{ display: 'flex' }} onClick={() => alertContext.removeAlert(alert)}>
            <Icon
              path={mdiClose}
              size={1}
              className="has-text-grey-light"
              style={{ cursor: 'pointer' }}
            />
          </div>
        </span>
      )}
    </div>
  )
}
