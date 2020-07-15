import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const today = new Date()

export default class Event {
  public id: number
  public calendar_id: string

  public title: string
  public start: Date
  public end: Date
  public creating: boolean
  public description: string
  public labels: Label[]

  public isAllDay: boolean
  public backgroundColor: string
  public foregroundColor: string

  get dayDisplay() {
    return `${MONTHS[this.start.getMonth()]} ${this.start.getDate()}`
  }

  public getDuration(): string {
    const milliseconds = this.end.getTime() - this.start.getTime()
    const minutes = milliseconds / 1000 / 60

    if (minutes < 60) {
      return `${minutes}m`
    } else {
      const hours = Math.floor(minutes / 60)
      const min = minutes % 60
      return min > 0 ? `${hours}h ${min}m` : `${hours}h`
    }
  }

  static foregroundColor(end: Date, foregroundColor: string) {
    return end < today ? 'hsl(0, 0%, 40%)' : foregroundColor
  }

  static backgroundColor(end: Date, backgroundColor: string) {
    if (end < today) {
      const { h, s } = hexToHSL(backgroundColor)
      const hsl = `hsl(${h}, ${s}%, 85%)`
      return hsl
    } else {
      return backgroundColor
    }
  }

  static fromJson(eventJson): Event {
    return new Event(
      eventJson.id,
      eventJson.calendar_id,
      eventJson.title,
      eventJson.description,
      new Date(eventJson.start),
      new Date(eventJson.end),
      false,
      eventJson.labels.map((labelJson) => Label.fromJson(labelJson)),
      eventJson.all_day,
      eventJson.background_color,
      eventJson.foreground_color
    )
  }

  static newDefaultEvent(start: Date, end: Date): Event {
    return new Event(-1, '', '', null, start, end, true, [], false, '#7986CB', '#fff')
  }

  constructor(
    id: number,
    calendar_id: string,
    title: string,
    description: string,
    start: Date,
    end: Date,
    creating: boolean,
    labels: Label[],
    isAllDay: boolean,
    backgroundColor: string,
    foregroundColor: string
  ) {
    this.id = id
    this.calendar_id = calendar_id
    this.title = title // ? title : '(No title)'
    this.start = start
    this.end = end
    this.creating = creating
    this.description = description
    this.labels = labels
    this.isAllDay = isAllDay

    this.backgroundColor = Event.backgroundColor(end, backgroundColor)
    this.foregroundColor = Event.foregroundColor(end, foregroundColor)
  }
}
