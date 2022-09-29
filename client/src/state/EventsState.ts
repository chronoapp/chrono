import { atom, selector } from 'recoil'

import { produce } from 'immer'

import Event from '@/models/Event'
import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'

export type Action = 'MOVE' | 'RESIZE'
export type Direction = 'UP' | 'DOWN'
export type DisplayView = 'Day' | 'Week' | 'WorkWeek' | 'Month'

export type EditRecurringAction = 'SINGLE' | 'THIS_AND_FOLLOWING' | 'ALL'
export type EditMode = 'READ' | 'EDIT' | 'FULL_EDIT'

export interface DragDropAction {
  action: Action
  event: Event
  pointerDate: Date | null
  interacting: boolean | undefined
  direction: Direction | undefined
}

export type EventDict = Record<string, Event>

export type EditingEvent = {
  id: string
  originalCalendarId: string | undefined
  editMode: EditMode
  selectTailSegment: boolean
  event: Event
  editRecurringAction: EditRecurringAction
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

export const displayState = atom({
  key: 'display-state',
  default: {
    view: 'Week' as DisplayView,
    selectedDate: new Date(),
  },
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

        if (draft.hasOwnProperty(calendarId)) {
          if (editingEvent.originalCalendarId) {
            delete draft[editingEvent.originalCalendarId][editingEvent.id]
          }

          draft[calendarId][editingEvent.id] = editingEvent.event
        }
        return draft
      })
    }

    return Object.values(eventWithEditing).flatMap((eventMap) => {
      return Object.values(eventMap)
    })
  },
})
