import { immerable } from 'immer'
import makeId from '@/lib/js-lib/makeId'

import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'
import { localFullDate, fullDayFormat } from '../util/localizer'
import EventParticipant from './EventParticipant'

export const EMPTY_TITLE = '(No title)'

/**
 * Derived preperties are static because we could use the spread operator {..event, ..}
 * to copy the event for drag & drop.
 */
export default class Event {
  [immerable] = true

  constructor(
    readonly id: string,
    readonly recurring_event_id: string | null,
    readonly title: string,
    readonly title_short: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly start_day: string | null,
    readonly end_day: string | null,
    readonly labels: Label[],
    readonly all_day: boolean,
    readonly backgroundColor: string,
    readonly foregroundColor: string,
    readonly recurrences: string[] | null,
    readonly original_start: Date | null,
    readonly original_start_day: string | null,
    readonly original_timezone: string | null,
    readonly participants: Partial<EventParticipant>[],

    // For UI only.
    readonly calendar_id: string,
    readonly synced: boolean
  ) {}

  static fromJson(calendarId: string, eventJson): Event {
    return new Event(
      eventJson.id,
      eventJson.recurring_event_id,
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
      eventJson.foreground_color,
      eventJson.recurrences,
      eventJson.original_start &&
        (eventJson.all_day
          ? localFullDate(eventJson.original_start_day)
          : new Date(eventJson.original_start)),
      eventJson.original_start_day,
      eventJson.original_timezone,
      eventJson.participants.map((participantJson) => EventParticipant.fromJson(participantJson)),
      calendarId,
      true
    )
  }

  static getBackgroundColor(event: Event, defaultColor: string, today: Date) {
    if (event.end < today) {
      const { h, s } = hexToHSL(defaultColor)
      const hsl = `hsl(${h}, ${s}%, 85%)`
      return hsl
    } else {
      return defaultColor
    }
  }

  static getForegroundColor(event: Event, today: Date) {
    return event.end < today ? 'hsl(0, 0%, 45%)' : event.foregroundColor
  }

  static newDefaultEvent(startDate: Date, endDate: Date, allDay: boolean) {
    const tempId = makeId()

    return new Event(
      tempId,
      null,
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
      '#fff',
      null,
      null,
      null,
      null,
      [],
      '',
      false
    )
  }

  static getDefaultTitle(title?: string) {
    return title ? title : EMPTY_TITLE
  }

  static isParentRecurringEvent(event: Partial<Event>): boolean {
    return !!event.recurrences && !event.recurring_event_id
  }
}
