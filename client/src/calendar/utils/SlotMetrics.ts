import { DateTime } from 'luxon'

import * as dates from '../../util/dates-luxon'
import { Rect } from '../../util/Selection'

export const getDstOffset = (start: DateTime, end: DateTime): number => {
  return start.offset - end.offset
}

const getKey = (min: DateTime, max: DateTime, step: number, slots: number): string => {
  const startOfMin = min.startOf('minute').toMillis()
  const startOfMax = max.startOf('minute').toMillis()

  return `${startOfMin}${startOfMax}${step}-${slots}`
}

/**
 * Utility Class to manage time slots within day column.
 */
export default class SlotMetrics {
  readonly key: string
  readonly step: number
  readonly numSlots: number

  readonly start: DateTime
  readonly end: DateTime
  readonly totalMin: number
  readonly slots: DateTime[]
  readonly groups: DateTime[][]

  constructor(start: DateTime, end: DateTime, step: number, timeslots: number) {
    this.key = getKey(start, end, step, timeslots)

    // if the start is on a DST-changing day but *after* the moment of DST
    // transition we need to add those extra minutes to our minutesFromMidnight
    const daystart = start.startOf('day')
    const daystartdstoffset = getDstOffset(daystart, start)
    const totalMin = 1 + dates.diff(start, end, 'minutes') + getDstOffset(start, end)
    const minutesFromMidnight = dates.diff(daystart, start, 'minutes') + daystartdstoffset
    const numGroups = Math.ceil(totalMin / (step * timeslots))
    const numSlots = numGroups * timeslots

    const groups = new Array(numGroups)
    const slots = new Array(numSlots)

    // Each slot date is created from "zero", instead of adding `step` to
    // the previous one, in order to avoid DST oddities
    for (let grp = 0; grp < numGroups; grp++) {
      groups[grp] = new Array(timeslots)

      for (let slot = 0; slot < timeslots; slot++) {
        const slotIdx = grp * timeslots + slot
        const minFromStart = slotIdx * step
        // A date with total minutes calculated from the start of the day
        slots[slotIdx] = groups[grp][slot] = start.plus({
          minutes: minutesFromMidnight + minFromStart,
        })
      }
    }

    // Necessary to be able to select up until the last timeslot in a day
    const lastSlotMinFromStart = slots.length * step
    slots.push(start.plus({ minutes: minutesFromMidnight + lastSlotMinFromStart }))

    this.step = step
    this.numSlots = numSlots
    this.groups = groups
    this.start = start
    this.end = end
    this.totalMin = totalMin
    this.slots = slots
  }

  public positionFromDate(date: DateTime) {
    const diff = dates.diff(this.start, date, 'minutes') + getDstOffset(this.start, date)
    return Math.min(diff, this.totalMin)
  }

  public update(start: DateTime, end: DateTime, step: number, timeslots: number) {
    if (getKey(start, end, step, timeslots) !== this.key)
      return new SlotMetrics(start, end, step, timeslots)
    return this
  }

  public dateIsInGroup(date: DateTime, groupIndex: number): boolean {
    const nextGroup = this.groups[groupIndex + 1]
    return dates.inRange(
      date,
      this.groups[groupIndex][0],
      nextGroup ? nextGroup[0] : this.end,
      'minute'
    )
  }

  public nextSlot(slot: DateTime) {
    const slots = this.slots
    let next = slots[Math.min(slots.indexOf(slot) + 1, slots.length - 1)]
    // in the case of the last slot we won't a long enough range so manually get it
    if (next === slot) {
      next = slot.plus({ minutes: this.step })
    }
    return next
  }

  public closestSlotToPosition(percent: number) {
    const slot = Math.min(this.slots.length - 1, Math.max(0, Math.round(percent * this.numSlots)))
    return this.slots[slot]
  }

  public closestSlotFromPoint(
    pointY: number,
    boundaryRect: Rect,
    overflow: boolean = false
  ): DateTime {
    const range = Math.abs(boundaryRect.top - boundaryRect.bottom)
    const percent = (pointY - boundaryRect.top) / range
    if (overflow) {
      const slot = Math.min(this.slots.length - 1, Math.round(percent * this.numSlots))
      if (slot >= 0) {
        return this.slots[slot]
      } else {
        return this.slots[0].plus({ minutes: slot * this.step })
      }
    } else {
      return this.closestSlotToPosition(percent)
    }
  }

  public closestSlotFromDate(date: DateTime, offset = 0) {
    if (dates.lt(date, this.start, 'minute')) return this.slots[0]

    const diffMins = dates.diff(this.start, date, 'minutes')
    return this.slots[(diffMins - (diffMins % this.step)) / this.step + offset]
  }

  public startsBeforeDay(date: DateTime) {
    return dates.lt(date, this.start, 'day')
  }

  public startsAfterDay(date: DateTime) {
    return dates.gt(date, this.end, 'day')
  }

  public startsBefore(date: DateTime) {
    return dates.lt(dates.merge(this.start, date), this.start, 'minute')
  }

  public startsAfter(date: DateTime) {
    return dates.gt(dates.merge(this.end, date), this.end, 'minute')
  }

  public getRange(
    rangeStart: DateTime,
    rangeEnd: DateTime,
    ignoreMin: boolean = false,
    ignoreMax: boolean = false
  ) {
    if (!ignoreMin) {
      rangeStart = dates.min(this.end, dates.max(this.start, rangeStart))
    }
    if (!ignoreMax) {
      rangeEnd = dates.min(this.end, dates.max(this.start, rangeEnd))
    }

    const rangeStartMin = this.positionFromDate(rangeStart)
    const rangeEndMin = this.positionFromDate(rangeEnd)
    const top =
      rangeEndMin > this.step * this.numSlots && !dates.eq(this.end, rangeEnd)
        ? ((rangeStartMin - this.step) / (this.step * this.numSlots)) * 100 // closest step
        : (rangeStartMin / (this.step * this.numSlots)) * 100

    return {
      top,
      height: (rangeEndMin / (this.step * this.numSlots)) * 100 - top,
      start: this.positionFromDate(rangeStart),
      startDate: rangeStart,
      end: this.positionFromDate(rangeEnd),
      endDate: rangeEnd,
    }
  }

  public getCurrentTimePosition(rangeStart) {
    const rangeStartMin = this.positionFromDate(rangeStart)
    const top = (rangeStartMin / (this.step * this.numSlots)) * 100

    return top
  }
}
