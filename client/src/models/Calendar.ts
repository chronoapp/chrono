import { immerable } from 'immer'
import Event from '@/models/Event'
import ReminderOverride from '@/models/ReminderOverride'
import { CalendarProvider } from './CalendarAccount'

export type AccessRole = 'reader' | 'writer' | 'owner' | 'freeBusyReader'
export interface CalendarEditable {
  summary: string
  description: string
  source: CalendarProvider
  foregroundColor: string
  backgroundColor: string
  timezone: string | undefined
}

export default class Calendar implements CalendarEditable {
  [immerable] = true

  static fromJson(json): Calendar {
    return new Calendar(
      json.id,
      json.account_id,
      json.google_id,
      json.summary,
      json.summaryOverride,
      json.description,
      json.backgroundColor,
      json.foregroundColor,
      json.selected,
      json.primary,
      json.accessRole,
      json.source,
      json.timezone,
      json.email,
      json.reminders.map((reminderJson) => ReminderOverride.fromJson(reminderJson))
    )
  }

  constructor(
    readonly id: string,
    readonly account_id: string,
    readonly google_id: string | null,
    readonly summary: string,
    readonly summaryOverride: string,
    readonly description: string,
    readonly backgroundColor: string,
    readonly foregroundColor: string,
    readonly selected: boolean,
    readonly primary: boolean,
    readonly accessRole: AccessRole,
    readonly source: CalendarProvider,
    readonly timezone: string,
    readonly email: string,
    readonly reminders: ReminderOverride[]
  ) {}

  public isWritable(): boolean {
    return this.accessRole == 'writer' || this.accessRole == 'owner'
  }

  public canEditEvent(event: Event) {
    if (!this.isWritable()) {
      return false
    }

    if (event.organizer?.email == this.email) {
      return true
    }

    return false
  }
}
