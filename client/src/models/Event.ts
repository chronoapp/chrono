import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'
import { localFullDate } from '../util/localizer'

const today = new Date()

/**
 * Fields only because it is copied for drag & drop.
 */
export default class Event {
  public labels: Label[]

  constructor(
    readonly id: number,
    readonly calendar_id: string,
    readonly title: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly startDate: string | null,
    readonly endDate: string | null,
    labels: Label[],
    readonly isAllDay: boolean,
    readonly backgroundColor: string,
    readonly foregroundColor: string
  ) {
    this.labels = labels
  }

  static fromJson(eventJson): Event {
    return new Event(
      eventJson.id,
      eventJson.calendar_id,
      eventJson.title,
      eventJson.description,
      eventJson.all_day ? localFullDate(eventJson.start_date) : new Date(eventJson.start),
      eventJson.all_day ? localFullDate(eventJson.end_date) : new Date(eventJson.end),
      eventJson.start_date,
      eventJson.end_date,
      eventJson.labels.map((labelJson) => Label.fromJson(labelJson)),
      eventJson.all_day,
      eventJson.background_color,
      eventJson.foreground_color
    )
  }

  static isNewEvent(event: Event) {
    return event.id == -1
  }

  static getBackgroundColor(event: Event, defaultColor: string) {
    if (event.end < today) {
      const { h, s } = hexToHSL(defaultColor)
      const hsl = `hsl(${h}, ${s}%, 85%)`
      return hsl
    } else {
      return defaultColor
    }
  }

  static getForegroundColor(event: Event) {
    return event.end < today ? 'hsl(0, 0%, 45%)' : event.foregroundColor
  }

  static newDefaultEvent(startDate: Date, endDate: Date) {
    return new Event(-1, '', '', '', startDate, endDate, null, null, [], false, '', '#fff')
  }
}
