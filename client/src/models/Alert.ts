import { IconType } from 'react-icons'
import { generateGuid } from '../lib/uuid'

export default class Alert {
  readonly id: string
  readonly title: string
  readonly icon?: IconType
  readonly removeAlertId?: string
  readonly isLoading: boolean
  readonly autoDismiss: boolean

  /**
   * @param title Alert Message
   * @param icon icon JSX Element
   */
  constructor(alert: {
    title: string
    icon?: IconType
    removeAlertId?: string
    isLoading?: boolean
    autoDismiss?: boolean
  }) {
    this.id = generateGuid()
    this.title = alert.title
    this.icon = alert.icon
    this.removeAlertId = alert.removeAlertId
    this.isLoading = alert.isLoading || false
    this.autoDismiss = alert.autoDismiss || false
  }
}
