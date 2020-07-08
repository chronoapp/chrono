import Event from '../../models/Event'
import { eventSegments, endOfRange, eventLevels, EventSegment } from './eventLevels'

let isSegmentInSlot = (seg, slot) => seg.left <= slot && seg.right >= slot
const isEqual = (a, b) => a[0].range === b[0].range && a[0].events === b[0].events

export default class DateSlotMetrics {
  readonly first: Date
  readonly last: Date
  readonly range: Date[]
  readonly segments: EventSegment[]

  // 2d array of levels of events.
  readonly levels: EventSegment[][]

  constructor(range: Date[], events: Event[], maxRows: number, minRows: number) {
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
  }

  public getDateForSlot(slotNumber: number) {
    return this.range[slotNumber]
  }
}
