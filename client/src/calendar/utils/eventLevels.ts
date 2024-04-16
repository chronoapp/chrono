import { ZonedDateTime as DateTime, ChronoUnit } from '@js-joda/core'

import Event from '@/models/Event'
import * as dates from '@/util/dates-joda'

export class EventSegment {
  constructor(
    readonly event: Event,
    readonly span: number,
    readonly left: number,
    readonly right: number
  ) {}
}

export function endOfRange(dateRange: DateTime[], unit: ChronoUnit = ChronoUnit.DAYS) {
  return {
    first: dateRange[0],
    last: dates.add(dateRange[dateRange.length - 1], 1, unit),
  }
}

export function eventSegments(event: Event, range: DateTime[]): EventSegment {
  const { first, last } = endOfRange(range)
  const slots = dates.diff(first, last, ChronoUnit.DAYS)

  let start = dates.max(dates.startOf(event.start, ChronoUnit.DAYS), first)
  let end = dates.min(dates.endOf(event.end, ChronoUnit.DAYS), last)

  let padding = range.findIndex((x) => dates.eq(x, start, ChronoUnit.DAYS))
  let span = dates.diff(start, end, ChronoUnit.DAYS)

  span = Math.min(span, slots)
  span = Math.max(span, 1)

  return new EventSegment(event, span, padding + 1, Math.max(padding + span, 1))
}

export function eventLevels(
  rowSegments: EventSegment[],
  limit: number = Infinity
): { levels: EventSegment[][]; extra: EventSegment[] } {
  let i
  let j
  let seg: EventSegment
  let levels: EventSegment[][] = []
  let extra: EventSegment[] = []

  for (i = 0; i < rowSegments.length; i++) {
    seg = rowSegments[i]

    for (j = 0; j < levels.length; j++) if (!segsOverlap(seg, levels[j])) break

    if (j >= limit) {
      extra.push(seg)
    } else {
      ;(levels[j] || (levels[j] = [])).push(seg)
    }
  }

  for (i = 0; i < levels.length; i++) {
    levels[i].sort((a, b) => a.left - b.left)
  }

  return {
    levels,
    extra,
  }
}

export function inRange(e: Event, start: DateTime, end: DateTime) {
  let eStart = dates.startOf(e.start, ChronoUnit.DAYS)
  let eEnd = e.end

  let startsBeforeEnd = dates.lte(eStart, end, ChronoUnit.DAYS)
  // when the event is zero duration we need to handle a bit differently
  let endsAfterStart = !dates.eq(eStart, eEnd, ChronoUnit.MINUTES)
    ? dates.gt(eEnd, start, ChronoUnit.MINUTES)
    : dates.gte(eEnd, start, ChronoUnit.MINUTES)

  return startsBeforeEnd && endsAfterStart
}

export function segsOverlap(seg, otherSegs) {
  return otherSegs.some((otherSeg) => otherSeg.left <= seg.right && otherSeg.right >= seg.left)
}

export function sortEvents(evtA: Event, evtB: Event) {
  // Order by full day events first, then sort by start time
  const startSort = dates.subDates(
    dates.startOf(evtA.start, ChronoUnit.DAYS),
    dates.startOf(evtB.start, ChronoUnit.DAYS)
  )

  let durA = dates.diff(evtA.start, dates.endOf(evtA.end, ChronoUnit.DAYS), ChronoUnit.DAYS)
  let durB = dates.diff(evtB.start, dates.endOf(evtB.end, ChronoUnit.DAYS), ChronoUnit.DAYS)

  return (
    startSort || // sort by start Day first
    Math.max(durB, 1) - Math.max(durA, 1) || // events spanning multiple days go first
    +evtB.all_day - +evtA.all_day || // then allDay single day events
    dates.subDates(evtA.start, evtB.start) || // then sort by start time
    dates.subDates(evtA.end, evtB.end) || // then sort by end time
    (evtA.title || '').localeCompare(evtB.title || '') // then sort by title
  )
}
