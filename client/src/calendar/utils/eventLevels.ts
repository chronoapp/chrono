import Event from '../../models/Event'
import * as dates from '../../util/dates'

export class EventSegment {
  constructor(
    readonly event: Event,
    readonly span: number,
    readonly left: number,
    readonly right: number
  ) {}
}

export function endOfRange(dateRange: Date[], unit = 'day') {
  return {
    first: dateRange[0],
    last: dates.add(dateRange[dateRange.length - 1], 1, unit),
  }
}

export function eventSegments(event: Event, range: Date[]): EventSegment {
  const { first, last } = endOfRange(range)
  const slots = dates.diff(first, last, 'day')

  let start = dates.max(dates.startOf(event.start, 'day'), first)
  let end = dates.min(dates.endOf(event.end, 'day'), last)

  let padding = range.findIndex((x) => dates.eq(x, start, 'day'))
  let span = dates.diff(start, end, 'day')

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

export function inRange(e: Event, start: Date, end: Date) {
  let eStart = dates.startOf(e.start, 'day')
  let eEnd = e.end

  let startsBeforeEnd = dates.lte(eStart, end, 'day')
  // when the event is zero duration we need to handle a bit differently
  let endsAfterStart = !dates.eq(eStart, eEnd, 'minutes')
    ? dates.gt(eEnd, start, 'minutes')
    : dates.gte(eEnd, start, 'minutes')

  return startsBeforeEnd && endsAfterStart
}

export function segsOverlap(seg, otherSegs) {
  return otherSegs.some((otherSeg) => otherSeg.left <= seg.right && otherSeg.right >= seg.left)
}

export function sortEvents(evtA: Event, evtB: Event) {
  let startSort = +dates.startOf(evtA.start, 'day') - +dates.startOf(evtB.start, 'day')

  let durA = dates.diff(evtA.start, dates.endOf(evtA.end, 'day'), 'day')
  let durB = dates.diff(evtB.start, dates.endOf(evtB.end, 'day'), 'day')

  return (
    startSort || // sort by start Day first
    Math.max(durB, 1) - Math.max(durA, 1) || // events spanning multiple days go first
    +evtB.all_day - +evtA.all_day || // then allDay single day events
    +evtA.start - +evtB.start || // then sort by start time
    +evtA.end - +evtB.end || // then sort by end time
    (evtA.title || '').localeCompare(evtB.title) // then sort by title
  )
}
