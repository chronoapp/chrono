import { immerable } from 'immer'
import Event from '@/models/Event'
import ReminderOverride from '@/models/ReminderOverride'

export type AccessRole = 'reader' | 'writer' | 'owner' | 'freeBusyReader'
export type CalendarSource = 'google' | 'chrono'

export interface CalendarEditable {
  summary: string
  description: string
  source: CalendarSource
  backgroundColor: string
  timezone: string | undefined
}

export default class Calendar implements CalendarEditable {
  [immerable] = true

  static fromJson(json): Calendar {
    return new Calendar(
      json.id,
      json.summary,
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
    readonly summary: string,
    readonly description: string,
    readonly backgroundColor: string,
    readonly foregroundColor: string,
    readonly selected: boolean,
    readonly primary: boolean,
    readonly accessRole: AccessRole,
    readonly source: CalendarSource,
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
