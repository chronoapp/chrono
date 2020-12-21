import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'
import { localFullDate, fullDayFormat } from '../util/localizer'

const today = new Date()

/**
 * Contains fields only because it is copied for drag & drop.
 */
export default class Event {
  public labels: Label[]

  constructor(
    readonly id: number,
    readonly recurring_event_id: number,
    readonly calendar_id: string,
    readonly title: string,
    readonly title_short: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly start_day: string | null,
    readonly end_day: string | null,
    labels: Label[],
    readonly all_day: boolean,
    readonly backgroundColor: string,
    readonly foregroundColor: string
  ) {
    this.labels = labels
  }

  static fromJson(eventJson): Event {
    return new Event(
      eventJson.id,
      eventJson.recurring_event_id,
      eventJson.calendar_id,
      eventJson.title,
      eventJson.title_short,
      eventJson.description,
      eventJson.all_day ? localFullDate(eventJson.start_day) : new Date(eventJson.start),
      eventJson.all_day ? localFullDate(eventJson.end_day) : new Date(eventJson.end),
      eventJson.start_day,
      eventJson.end_day,
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

  static newDefaultEvent(startDate: Date, endDate: Date, allDay: boolean) {
    return new Event(
      -1,
      -1,
      '',
      '',
      '',
      '',
      startDate,
      endDate,
      allDay ? fullDayFormat(startDate) : null,
      allDay ? fullDayFormat(endDate) : null,
      [],
      allDay,
      '',
      '#fff'
    )
  }

  static getDefaultTitle(event: Event) {
    return event.title ? event.title : '(No title)'
  }
}
