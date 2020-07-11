import { Label } from './Label'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export class CalendarEvent {
  id: number
  title: string
  description: string
  startTime: Date
  endTime: Date
  labels: Label[]
  dayDisplay: string
  allDay: boolean
  backgroundColor: string

  static fromJson(eventJson): CalendarEvent {
    return new CalendarEvent(
      eventJson.id,
      eventJson.title,
      eventJson.description,
      new Date(eventJson.start_time),
      new Date(eventJson.end_time),
      eventJson.labels.map((labelJson) => Label.fromJson(labelJson)),
      eventJson.all_day,
      eventJson.background_color
    )
  }

  constructor(
    id: number,
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    labels: Label[],
    allDay: boolean,
    backgroundColor: string
  ) {
    this.id = id
    this.title = title
    this.description = description
    this.startTime = startTime
    this.endTime = endTime
    this.labels = labels
    this.dayDisplay = `${MONTHS[this.startTime.getMonth()]} ${this.startTime.getDate()}`
    this.allDay = allDay
    this.backgroundColor = backgroundColor
  }

  public toDict() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      start_time: this.startTime,
      end_time: this.endTime,
      labels: this.labels,
    }
  }

  public getDuration(): string {
    const milliseconds = this.endTime.getTime() - this.startTime.getTime()
    const minutes = milliseconds / 1000 / 60

    if (minutes < 60) {
      return `${minutes}m`
    } else {
      const hours = Math.floor(minutes / 60)
      const min = minutes % 60
      return min > 0 ? `${hours}h ${min}m` : `${hours}h`
    }
  }
}

/**
 * TODO: Merge with CalendarEvent
 */
export default class Event {
  public id: number
  public title: string
  public start: Date
  public end: Date
  public creating: boolean
  public isAllDay: boolean
  public backgroundColor: string
  public foregroundColor: string

  constructor(
    id: number,
    title: string,
    start: Date,
    end: Date,
    creating: boolean,
    isAllDay: boolean,
    backgroundColor: string,
    foregroundColor: string
  ) {
    this.id = id
    this.title = title || '(No title)'
    this.start = start
    this.end = end
    this.creating = creating
    this.isAllDay = isAllDay
    this.backgroundColor = backgroundColor
    this.foregroundColor = foregroundColor
  }
}
