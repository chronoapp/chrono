import { DateTime } from 'luxon'
import * as dates from '@/util/dates-luxon'
import { produce } from 'immer'

import { getRecurrenceRules } from '@/calendar/event-edit/RecurringEventEditor'
import { RRule, datetime } from 'rrule'

/**
 * Gets the recurrence for this and following events.
 *
 * originalStartDt is the start date of the recurring event.
 *
 * splitDateOriginalStart is the original start date of the event that we are splitting.
 *
 * splitDateNewStart is the this & following date. It is used to set the until date
 * so that we can extend the original recurrence.
 *
 * Note that we don't use DTSTART or DTEND in the recurrence. Instead, we
 * use the property in the event.
 */
export function getSplitRRules(
  recurrenceStr: string,
  originalStartDt: DateTime,
  splitDateOriginalStart: DateTime,
  splitDateNewStart: DateTime,
  isAllDay: boolean
) {
  if (!dates.lte(originalStartDt, splitDateOriginalStart)) {
    throw new Error('splitDateOriginalStart must be after originalStartDt')
  }

  const ruleOptions = getRecurrenceRules(recurrenceStr, originalStartDt)

  let splitDate
  if (isAllDay) {
    const year = splitDateNewStart.year
    const month = splitDateNewStart.month
    const day = splitDateNewStart.day - 1 // stop one day before
    splitDate = datetime(year, month, day)
  } else {
    splitDate = dates.subtract(splitDateOriginalStart, 1, 'second')
  }

  if (ruleOptions.count) {
    const upToThisEventRules = produce(ruleOptions, (draft) => {
      delete draft['count']
      draft.until = splitDate
      draft.dtstart = originalStartDt.toJSDate()
    })

    const upToThisRRule = new RRule(upToThisEventRules)
    const upToThisCount = upToThisRRule.all().length

    const startRule = new RRule({
      ...ruleOptions,
      dtstart: null,
      until: null,
      count: upToThisCount,
    })

    const endRule = new RRule({
      ...ruleOptions,
      dtstart: null,
      until: null,
      count: ruleOptions.count - upToThisCount,
    })

    return { start: startRule, end: endRule }
  } else {
    // Set an until date for the recurrence
    const upToThisEventRules = produce(ruleOptions, (draft) => {
      delete draft['count']
      draft.until = splitDate
    })

    const startRule = new RRule(upToThisEventRules)
    const endRule = new RRule({
      ...ruleOptions,
      until: ruleOptions.until
        ? dates.max(DateTime.fromJSDate(ruleOptions.until), splitDateNewStart).toJSDate()
        : ruleOptions.until,
    })

    return { start: startRule, end: endRule }
  }
}
