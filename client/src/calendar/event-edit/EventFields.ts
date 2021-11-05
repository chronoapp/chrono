import { Label } from '@/models/Label'
import Event from '@/models/Event'

/**
 * Editable fields in event.
 */
export default class EventFields {
  public constructor(
    readonly title: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly labels: Label[],
    readonly calendarId: string,
    readonly allDay: boolean,
    readonly startDay: string | null,
    readonly endDay: string | null,
    readonly recurrences: string | null
  ) {}

  static getMutableEventFields(eventFields: EventFields): Partial<Event> {
    return {
      title: eventFields.title,
      description: eventFields.description,
      start: eventFields.start,
      end: eventFields.end,
      all_day: eventFields.allDay,
      start_day: eventFields.startDay,
      end_day: eventFields.endDay,
      labels: eventFields.labels,
      calendar_id: eventFields.calendarId,
      recurrences: eventFields.recurrences ? [eventFields.recurrences] : null,
    }
  }
}