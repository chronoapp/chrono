import { atom, selector } from 'recoil'
import { DateTime } from 'luxon'

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
})

export const editingEventState = atom({
  key: 'editing-event-state',
  default: null as EditingEvent | null,
})

export const dragDropActionState = atom({
  key: 'drag-drop-action-state',
  default: null as DragDropAction | null,
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
    const primaryTimezone = User.getPrimaryTimezone(user!)

    const { eventsByCalendar } = events
    const selectedCalendarIds = Object.values(calendars.calendarsById)
      .filter((cal) => cal.selected)
      .map((cal) => cal.id)

    let allEvents: Event[] = []

    selectedCalendarIds.forEach((calId) => {
      const events = eventsByCalendar[calId]
      if (events) {
        Object.values(events).forEach((event) => {
          allEvents.push(adjustEventTimezone(event, primaryTimezone))
        })
      }
    })

    // Add the editing event to the event list if it exists.
    if (editingEvent) {
      // Optionally, remove the event from its original calendar if moved.
      // This requires identifying and removing it from allEvents if necessary.
      // Then add/update the editing event in its current or primary calendar.

      // Find and remove the editing event if it was moved from another calendar.
      allEvents = allEvents.filter((event) => event.id !== editingEvent.id)

      // Add the editing event to the list.
      allEvents.push(adjustEventTimezone(editingEvent.event, primaryTimezone))
    }

    return allEvents
  },
})

const adjustEventTimezone = (event, timezone: string) => ({
  ...event,
  start: event.start.setZone(timezone),
  end: event.end.setZone(timezone),
  original_start: event.original_start?.setZone(timezone),
})
