import * as dates from '@/util/dates'
import { produce } from 'immer'

import { getRecurrenceRules } from '@/calendar/event-edit/RecurringEventEditor'
import { RRule } from 'rrule'

/**
 * Gets the recurrence for this and following events.
 *
 * Note that we don't use DTSTART or DTEND in the recurrence. Instead, we
 * use the property in the event.
 */
export function getSplitRRules(recurrenceStr: string, originalStartDt: Date, splitDt: Date) {
  const ruleOptions = getRecurrenceRules(recurrenceStr, originalStartDt)

  if (ruleOptions.count) {
    const upToThisEventRules = produce(ruleOptions, (draft) => {
      delete draft['count']
      draft.until = dates.subtract(splitDt, 1, 'seconds')
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
      draft.until = dates.subtract(splitDt, 1, 'seconds')
    })

    const startRule = new RRule(upToThisEventRules)
    const endRule = new RRule({
      ...ruleOptions,
      until: ruleOptions.until,
    })

    return { start: startRule, end: endRule }
  }
}
