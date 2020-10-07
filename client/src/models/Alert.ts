import { generateGuid } from '../lib/uuid'

export default class Alert {
  readonly id: string
  readonly title: string
  readonly iconType?: string
  readonly removeAlertId?: string
  readonly isLoading: boolean
  readonly autoDismiss: boolean

  /**
   * @param title Alert Message
   * @param iconType icon string (e.g. mdiCheck from mdi/js)
   */
  constructor(alert: {
    title: string
    iconType?: string
    removeAlertId?: string
    isLoading?: boolean
    autoDismiss?: boolean
  }) {
    this.id = generateGuid()
    this.title = alert.title
    this.iconType = alert.iconType
    this.removeAlertId = alert.removeAlertId
    this.isLoading = alert.isLoading || false
    this.autoDismiss = alert.autoDismiss || false
  }
}
