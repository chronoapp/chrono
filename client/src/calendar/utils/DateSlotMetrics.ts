import Event from '../../models/Event'
import { eventSegments, endOfRange, eventLevels, EventSegment } from './eventLevels'

let isSegmentInSlot = (seg, slot) => seg.left <= slot && seg.right >= slot
const isEqual = (a, b) => a[0].range === b[0].range && a[0].events === b[0].events

class DateSlotMetrics {
  public segments: EventSegment[]

  contructor(range: Date[], events: Event[], maxRows: number, minRows: number) {
    const { first, last } = endOfRange(range)
    this.segments = events.map((evt) => eventSegments(evt, range))

    let { levels, extra } = eventLevels(this.segments, Math.max(maxRows - 1, 1))
    while (levels.length < minRows) {
      levels.push([])
    }
  }
}

export default DateSlotMetrics
