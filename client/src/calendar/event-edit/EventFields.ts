import { ZonedDateTime as DateTime } from '@js-joda/core'

import { Label } from '@/models/Label'
import Event, { Transparency, Visibility } from '@/models/Event'
import EventParticipant from '@/models/EventParticipant'
import ConferenceData from '@/models/ConferenceData'
import ReminderOverride from '@/models/ReminderOverride'

const TitleRegex = /@\[([\wd.-_ @]+)\]\(\[id:\w+\]\[type:\w+\]\)/

function getShortTitle(title: string) {
  return title.replace(TitleRegex, '$1')
}

/**
 * Editable fields in event.
 */
export default class EventFields {
  public constructor(
    readonly title: string,
    readonly description: string,
    readonly start: DateTime,
    readonly end: DateTime,
    readonly labels: Label[],
    readonly calendarId: string,
    readonly allDay: boolean,
    readonly startDay: string | null,
    readonly endDay: string | null,
    readonly organizer: Partial<EventParticipant> | null,
    readonly recurrences: string | null,
    readonly guestsCanModify: boolean,
    readonly guestsCanInviteOthers: boolean,
    readonly guestsCanSeeOtherGuests: boolean,
    readonly conferenceData: ConferenceData | null,
    readonly location: string | null,
    readonly visibility: Visibility,
    readonly transparency: Transparency,
    readonly useDefaultReminders: boolean,
    readonly reminders: ReminderOverride[]
  ) {}

  /**
   * Mutable fields we can update in the event.
   */
  static getMutableEventFields(eventFields: EventFields): Partial<Event> {
    return {
      title: eventFields.title,
      title_short: getShortTitle(eventFields.title),
      description: eventFields.description,
      start: eventFields.start,
      end: eventFields.end,
      all_day: eventFields.allDay,
      start_day: eventFields.startDay,
      end_day: eventFields.endDay,
      labels: eventFields.labels,
      calendar_id: eventFields.calendarId,
      organizer: eventFields.organizer,
      recurrences: eventFields.recurrences ? [eventFields.recurrences] : null,
      guests_can_modify: eventFields.guestsCanModify,
      guests_can_invite_others: eventFields.guestsCanInviteOthers,
      guests_can_see_other_guests: eventFields.guestsCanSeeOtherGuests,
      location: eventFields.location,
      visibility: eventFields.visibility,
      transparency: eventFields.transparency,
      use_default_reminders: eventFields.useDefaultReminders,
      reminders: eventFields.reminders,
      conference_data: eventFields.conferenceData,
    }
  }
}
