import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'

const today = new Date()

/**
 * Fields only because it is copied for drag & drop.
 */
export default class Event {
  constructor(
    readonly id: number,
    readonly calendar_id: string,
    readonly title: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly labels: Label[],
    readonly isAllDay: boolean,
    readonly backgroundColor: string,
    readonly foregroundColor: string
  ) {}

  static fromJson(eventJson): Event {
    return new Event(
      eventJson.id,
      eventJson.calendar_id,
      eventJson.title,
      eventJson.description,
      new Date(eventJson.start),
      new Date(eventJson.end),
      eventJson.labels.map((labelJson) => Label.fromJson(labelJson)),
      eventJson.all_day,
      eventJson.background_color,
      eventJson.foreground_color
    )
  }

  static isNewEvent(event: Event) {
    return event.id == -1
  }
}
