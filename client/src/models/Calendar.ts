import { immerable } from 'immer'

export type AccessRole = 'reader' | 'writer' | 'owner' | 'freeBusyReader'
export type CalendarSource = 'google' | 'timecouncil'

export default class Calendar {
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
      json.source
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
    readonly source: CalendarSource
  ) {}

  public isWritable(): boolean {
    return this.accessRole == 'writer' || this.accessRole == 'owner'
  }
}
