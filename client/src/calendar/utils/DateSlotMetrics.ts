import { DateTime } from 'luxon'

import Event from '../../models/Event'
import { eventSegments, endOfRange, eventLevels, EventSegment } from './eventLevels'

let isSegmentInSlot = (seg, slot) => seg.left <= slot && seg.right >= slot

const isEqual = (a, b) => a[0].range === b[0].range && a[0].events === b[0].events

export default class DateSlotMetrics {
  readonly first: DateTime
  readonly last: DateTime
  readonly range: DateTime[]
  readonly segments: EventSegment[]
  readonly slots: number
  readonly extra: EventSegment[]

  // 2d array of levels of events.
  readonly levels: EventSegment[][]

  constructor(range: DateTime[], events: Event[], maxRows: number, minRows: number) {
    const { first, last } = endOfRange(range)

    const segments = events.map((evt) => eventSegments(evt, range))
    let { levels, extra } = eventLevels(segments, Math.max(maxRows - 1, 1))
    while (levels.length < minRows) {
      levels.push([])
    }

    this.first = first
    this.last = last
    this.range = range
    this.segments = segments
    this.levels = levels
    this.slots = this.range.length
    this.extra = extra
  }

  public getDateForSlot(slotNumber: number) {
    return this.range[slotNumber]
  }
}
