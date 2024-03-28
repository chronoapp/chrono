import { atom, selector } from 'recoil'
import { DateTime } from 'luxon'
import { produce } from 'immer'

import Event from '@/models/Event'
import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
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

export const allVisibleEventsSelector = selector({
  key: 'all-visible-events',
  get: ({ get }) => {
    const events = get(eventsState)
    const calendars = get(calendarsState)
    const primaryCalendar = get(primaryCalendarSelector)
    const editingEvent = get(editingEventState)

    const { eventsByCalendar } = events
    const selectedCalendarIds = Object.values(calendars.calendarsById)
      .filter((cal) => cal.selected)
      .map((cal) => cal.id)

    let eventWithEditing = Object.fromEntries(
      selectedCalendarIds.map((calId) => {
        return [calId, eventsByCalendar[calId] || {}]
      })
    )

    if (editingEvent) {
      eventWithEditing = produce(eventWithEditing, (draft) => {
        const calendarId = editingEvent.event.calendar_id || primaryCalendar!.id

        if (editingEvent.originalCalendarId) {
          delete draft[editingEvent.originalCalendarId][editingEvent.id]
        }

        draft[calendarId] = {
          ...draft[calendarId],
          [editingEvent.id]: editingEvent.event,
        }

        return draft
      })
    }

    return Object.values(eventWithEditing).flatMap((eventMap) => {
      return Object.values(eventMap)
    })
  },
})
