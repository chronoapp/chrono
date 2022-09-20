import { immerable } from 'immer'

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
      json.email
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
    readonly email: string
  ) {}

  public isWritable(): boolean {
    return this.accessRole == 'writer' || this.accessRole == 'owner'
  }
}
