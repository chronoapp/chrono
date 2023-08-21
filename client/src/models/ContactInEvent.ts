import { immerable } from 'immer'
import Contact from './Contact'

export default class ContactInEvent {
  [immerable] = true

  constructor(
    readonly contact: Contact,
    readonly total_time_spent_in_seconds: number,
    readonly last_seen: Date
  ) {}
}
