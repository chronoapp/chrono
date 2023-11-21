import * as dates from '@/util/dates'
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
  originalStartDt: Date,
  splitDateOriginalStart: Date,
  splitDateNewStart: Date,
  isAllDay: boolean
) {
  if (!dates.lte(originalStartDt, splitDateOriginalStart)) {
    throw new Error('splitDateOriginalStart must be after originalStartDt')
  }

  const ruleOptions = getRecurrenceRules(recurrenceStr, originalStartDt)

  let untilDate
  if (isAllDay) {
    const year = splitDateNewStart.getUTCFullYear()
    const month = splitDateNewStart.getUTCMonth() + 1
    const day = splitDateNewStart.getUTCDate() - 1 // stop one day before
    untilDate = datetime(year, month, day)
  } else {
    untilDate = dates.subtract(splitDateNewStart, 1, 'seconds')
  }

  if (ruleOptions.count) {
    const upToThisEventRules = produce(ruleOptions, (draft) => {
      delete draft['count']
      draft.until = dates.subtract(splitDateOriginalStart, 1, 'seconds')
      draft.dtstart = originalStartDt
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
      draft.until = dates.subtract(splitDateOriginalStart, 1, 'seconds')
    })

    const startRule = new RRule(upToThisEventRules)
    const endRule = new RRule({
      ...ruleOptions,
      until: ruleOptions.until
        ? dates.max(ruleOptions.until, splitDateNewStart)
        : ruleOptions.until,
    })

    return { start: startRule, end: endRule }
  }
}
