import { immerable } from 'immer'
import { makeShortId } from '@/lib/js-lib/makeId'

import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'
import { localFullDate, fullDayFormat } from '../util/localizer'
import EventParticipant, { ResponseStatus } from './EventParticipant'
import Calendar from './Calendar'
import ConferenceData from './ConferenceData'
import ReminderOverride from './ReminderOverride'

export const EMPTY_TITLE = '(No title)'

export type SyncStatus = 'NOT_SYNCED' | 'SYNCING' | 'SYNCED'

export type Visibility = 'default' | 'public' | 'private' | 'confidential'
export type Transparency = 'opaque' | 'transparent'

/**
 * Derived preperties are static because we could use the spread operator {..event, ..}
 * to copy the event for drag & drop.
 *
 * Use static methods to get computed properties, since events are copied & methods
 * are not copied.
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
    readonly creator: Partial<EventParticipant> | null,
    readonly organizer: Partial<EventParticipant> | null,
    readonly participants: EventParticipant[],
    readonly guests_can_modify: boolean,
    readonly guests_can_invite_others: boolean,
    readonly guests_can_see_other_guests: boolean,
    readonly conference_data: ConferenceData | null,
    readonly location: string | null,
    readonly visibility: Visibility,
    readonly transparency: Transparency,
    readonly use_default_reminders: boolean,
    readonly reminders: ReminderOverride[],

    // For UI only.
    readonly calendar_id: string,
    readonly syncStatus: SyncStatus
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
      EventParticipant.fromJson(eventJson.creator),
      EventParticipant.fromJson(eventJson.organizer),
      eventJson.participants.map((participantJson) => EventParticipant.fromJson(participantJson)),
      eventJson.guests_can_modify,
      eventJson.guests_can_invite_others,
      eventJson.guests_can_see_other_guests,
      eventJson.conference_data && ConferenceData.fromJson(eventJson.conference_data),
      eventJson.location,
      eventJson.visibility,
      eventJson.transparency,
      eventJson.use_default_reminders,
      eventJson.reminders.map((reminderJson) => ReminderOverride.fromJson(reminderJson)),
      calendarId,
      'SYNCED'
    )
  }

  static getBackgroundColor(endDate: Date, defaultColor: string, today: Date) {
    if (endDate < today) {
      const { h, s } = hexToHSL(defaultColor)
      const hsl = `hsl(${h}, ${s}%, 90%)`
      return hsl
    } else {
      return defaultColor
    }
  }

  static getForegroundColor(
    endDate: Date,
    today: Date,
    foregroundColor: string,
    backgroundColor: string
  ) {
    if (endDate < today) {
      const { h, s } = hexToHSL(backgroundColor)
      const hsl = `hsla(${h}, ${s}%, 15%, 0.5)`
      return hsl
    } else {
      return foregroundColor
    }
  }

  static newDefaultEvent(calendar: Calendar, startDate: Date, endDate: Date, allDay: boolean) {
    const tempId = makeShortId()

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
      EventParticipant.fromCreatorOrOrganizer(calendar.email, calendar.summary) /*creator*/,
      EventParticipant.fromCreatorOrOrganizer(calendar.email, calendar.summary) /*organizer*/,
      [],
      false,
      true,
      true,
      null,
      null,
      'default',
      'opaque',
      true,
      [],
      calendar.id,
      'NOT_SYNCED'
    )
  }

  static getDefaultTitle(title?: string) {
    return title ? title : EMPTY_TITLE
  }

  static isParentRecurringEvent(event: Partial<Event>): boolean {
    return !!event.recurrences && !event.recurring_event_id
  }

  /**
   * From the perspective of this calendar, what is the response status
   * of the event?
   */
  static getResponseStatus(event: Event, calendar: Calendar): ResponseStatus {
    const email = calendar.email

    const participant = event.participants.find((p) => p.email === email)
    if (participant) {
      return participant.response_status!!
    }

    if (!email || event.organizer?.email == email) {
      return 'accepted'
    }

    return 'needsAction'
  }

  static hasNonOrganizerParticipants(event: Event) {
    return event.participants.filter((p) => p.email !== event.organizer?.email).length > 0
  }
}
