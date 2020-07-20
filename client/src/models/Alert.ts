export default class Alert {
  /**
   *
   * @param title Alert Message
   * @param iconType icon string (e.g. mdiCheck from mdi/js)
   */
  constructor(readonly title, readonly iconType?: string) {}
}
