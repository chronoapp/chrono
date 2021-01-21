import { immerable } from 'immer'

export type AccessRole = 'reader' | 'writer' | 'owner' | 'freeBusyReader'

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
      json.isGoogleCalendar
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
    readonly isGoogleCalendar: boolean
  ) {}

  public isWritable(): boolean {
    return this.accessRole == 'writer' || this.accessRole == 'owner'
  }
}
