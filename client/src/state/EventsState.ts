import { atom, selector } from 'recoil'
import { ZonedDateTime as DateTime, ZoneId } from '@js-joda/core'

import Event from '@/models/Event'
import User from '@/models/User'

import { calendarsState } from '@/state/CalendarState'
import { userState } from '@/state/UserState'

export type Action = 'MOVE' | 'RESIZE'
export type Direction = 'UP' | 'DOWN'

export type EditRecurringAction = 'SINGLE' | 'THIS_AND_FOLLOWING' | 'ALL'
export type EditMode = 'READ' | 'EDIT' | 'FULL_EDIT' | 'MOVE_RESIZE'
export type EventEditAction = 'DELETE' | 'UPDATE' | 'CREATE'

/**
 * Context for updating an event, to show a confirmation dialog
 * 1) How to update a recurring event: single, this and following, all
 * 2) If there are participants, whether to send an update email
 */
export interface EventUpdateContext {
  eventEditAction: EventEditAction
  isRecurringEvent: boolean | undefined
  hasParticipants: boolean
  hasUpdatedRecurrenceString: boolean
}

export interface DragDropAction {
  action: Action
  event: Event
  pointerDate: DateTime | null
  interacting: boolean | undefined
  direction: Direction | undefined
}

export type EventDict = Record<string, Event>

export type EditingEvent = {
  id: string
  originalCalendarId: string | undefined
  editMode: EditMode
  selectTailSegment: boolean
  updateContext: EventUpdateContext | undefined
  originalEvent: Event
  event: Event
}

export interface EventState {
  loading: boolean
  eventsByCalendar: Record<string, EventDict>
  editingEvent: EditingEvent | null
}

export const eventsState = atom({
  key: 'events-state',
  default: {
    loading: true,
    eventsByCalendar: {},
    editingEvent: null,
  } as EventState,

  // Joda's ZonedDateTime, when used with a Non-System Timezone, uses property assignments,
  // which mutates its object internally. So we need to allow mutability to make sure recoil
  // does not deep freeze the ZonedDateTime object.
  dangerouslyAllowMutability: true,
})

export const editingEventState = atom({
  key: 'editing-event-state',
  default: null as EditingEvent | null,
  dangerouslyAllowMutability: true,
})

export const dragDropActionState = atom({
  key: 'drag-drop-action-state',
  default: null as DragDropAction | null,
  dangerouslyAllowMutability: true,
})

/**
 * Selector to get all visible events. This includes events from all selected calendars
 * and appends the editing event to the event list if it exists.
 */
export const allVisibleEventsSelector = selector({
  key: 'all-visible-events',
  get: ({ get }) => {
    const events = get(eventsState)
    const calendars = get(calendarsState)
    const editingEvent = get(editingEventState)
    const user = get(userState)
    if (!user) {
      return []
    }

    const primaryTimezone = User.getPrimaryTimezone(user!)

    const { eventsByCalendar } = events
    const selectedCalendarIds = Object.values(calendars.calendarsById)
      .filter((cal) => cal.selected)
      .map((cal) => cal.id)

    let allEvents: Event[] = []
    let replacedEditingEvent = false

    selectedCalendarIds.forEach((calId) => {
      const events = eventsByCalendar[calId]
      if (events) {
        Object.values(events).forEach((event) => {
          // Replace the event with the same id as the editing event with the editing event.
          // Do not check for the event's calendar ID, as the editing event may be moved to a different calendar.
          const isEditingEvent = editingEvent && editingEvent.id === event.id

          if (isEditingEvent) {
            replacedEditingEvent = true
            allEvents.push(adjustEventTimezone(editingEvent.event, primaryTimezone))
          } else {
            allEvents.push(adjustEventTimezone(event, primaryTimezone))
          }
        })
      }
    })

    // Editing event is not in the list of events, so add it to the list.
    if (editingEvent && !replacedEditingEvent) {
      allEvents.push(adjustEventTimezone(editingEvent.event, primaryTimezone))
    }

    return allEvents
  },

  dangerouslyAllowMutability: true,
})

const adjustEventTimezone = (event: Event, timezone: string): Event => ({
  ...event,
  start: event.start.withZoneSameInstant(ZoneId.of(timezone)),
  end: event.end.withZoneSameInstant(ZoneId.of(timezone)),
  original_start: event.original_start
    ? event.original_start.withZoneSameInstant(ZoneId.of(timezone))
    : null,
})
