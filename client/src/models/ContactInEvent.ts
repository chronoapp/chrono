import { ZonedDateTime as DateTime } from '@js-joda/core'
import * as localizer from '@/util/localizer-joda'

import { immerable } from 'immer'
import Contact from './Contact'

export default class ContactInEvent {
  [immerable] = true

  static fromJson(json: any): ContactInEvent {
    return new ContactInEvent(
      Contact.fromJson(json.contact),
      json.total_time_spent_in_seconds,
      json.last_seen ? localizer.localFullDate(json.last_seen) : null
    )
  }

  constructor(
    readonly contact: Contact,
    readonly total_time_spent_in_seconds: number | null,
    readonly last_seen: DateTime | null
  ) {}
}
