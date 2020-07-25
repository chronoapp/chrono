import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'

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

    this.backgroundColor = backgroundColor
    this.foregroundColor = foregroundColor
  }
}
