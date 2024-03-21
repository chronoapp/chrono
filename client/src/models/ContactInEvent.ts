import { DateTime } from 'luxon'

import { immerable } from 'immer'
import Contact from './Contact'

export default class ContactInEvent {
  [immerable] = true

  static fromJson(json: any): ContactInEvent {
    return new ContactInEvent(
      Contact.fromJson(json.contact),
      json.total_time_spent_in_seconds,
      DateTime.fromISO(json.last_seen)
    )
  }

  constructor(
    readonly contact: Contact,
    readonly total_time_spent_in_seconds: number,
    readonly last_seen: DateTime
  ) {}
}
