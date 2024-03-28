import { DateTime } from 'luxon'
import { immerable } from 'immer'
import { makeShortId } from '@/lib/js-lib/makeId'
import { localFullDate, formatFullDay } from '../util/localizer-luxon'

import { Label } from './Label'
import { hexToHSL } from '../calendar/utils/Colors'

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
    readonly start: DateTime,
    readonly end: DateTime,
    readonly start_day: string | null,
    readonly end_day: string | null,
    readonly labels: Label[],
    readonly all_day: boolean,
    readonly backgroundColor: string,
    readonly foregroundColor: string,
    readonly recurrences: string[] | null,
    readonly original_start: DateTime | null,
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
      eventJson.all_day ? localFullDate(eventJson.start_day) : localFullDate(eventJson.start),
      eventJson.all_day ? localFullDate(eventJson.end_day) : localFullDate(eventJson.end),
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
          : localFullDate(eventJson.original_start)),
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

  static getBackgroundColor(endDate: DateTime, defaultColor: string, today: DateTime) {
    const { h, s, l } = hexToHSL(defaultColor)
    const hsla = `hsla(${h}, ${s}%, 90%, 0.75)`
    return hsla
  }

  static getForegroundColor(endDate: DateTime, today: DateTime, defaultColor: string) {
    if (endDate < today) {
      const { h, s } = hexToHSL(defaultColor)
      const hsla = `hsla(${h}, ${s}%, 80%, 0.9)`
      return hsla
    } else {
      const { h, s, l } = hexToHSL(defaultColor)
      const defaultColorAsHSLA = `hsl(${h}, ${s}%, ${l}%, 1)`
      return defaultColorAsHSLA
    }
  }

  static newDefaultEvent(
    calendar: Calendar,
    startDate: DateTime,
    endDate: DateTime,
    allDay: boolean
  ) {
    const tempId = makeShortId()

    return new Event(
      tempId,
      null,
      '',
      '',
      '',
      startDate,
      endDate,
      allDay ? formatFullDay(startDate) : null,
      allDay ? formatFullDay(endDate) : null,
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

  /**
   * Gets the added, removed, and updated participants.
   */
  static getParticipantUpdates(event: Event, newEvent: Event) {
    // Maps for quick access
    const eventParticipants = event.participants.filter((p) => p.email !== event.organizer?.email)
    const newEventParticipants = newEvent.participants.filter(
      (p) => p.email !== newEvent.organizer?.email
    )

    const eventParticipantsByEmail = new Map(eventParticipants.map((p) => [p.email, p]))
    const newEventParticipantEmails = new Set(newEventParticipants.map((p) => p.email))

    const addedParticipants: EventParticipant[] = []
    const removedParticipants: EventParticipant[] = []
    const updatedParticipants: EventParticipant[] = []

    // Check for added and updated participants
    for (const participant of newEventParticipants) {
      if (!eventParticipantsByEmail.has(participant.email)) {
        addedParticipants.push(participant)
      } else {
        const oldParticipant = eventParticipantsByEmail.get(participant.email)
        if (oldParticipant && !oldParticipant.equals(participant)) {
          updatedParticipants.push(participant)
        }
      }
    }

    // Check for removed participants
    for (const [email, participant] of eventParticipantsByEmail) {
      if (!newEventParticipantEmails.has(email)) {
        removedParticipants.push(participant)
      }
    }

    return { addedParticipants, removedParticipants, updatedParticipants }
  }
}
