import { createContext, useReducer, useState } from 'react'
import { produce } from 'immer'

import { normalizeArr } from '../lib/normalizer'

import * as dates from '../util/dates'
import Event, { SyncStatus } from '../models/Event'
import Calendar from '@/models/Calendar'

export type Action = 'MOVE' | 'RESIZE'
export type Direction = 'UP' | 'DOWN'

export type Display = 'Day' | 'Week' | 'WorkWeek' | 'Month'

export type EditRecurringAction = 'SINGLE' | 'THIS_AND_FOLLOWING' | 'ALL'
type EditMode = 'READ' | 'EDIT' | 'FULL_EDIT'

export interface DragDropAction {
  action: Action
  event: Event
  pointerDate: Date | null
  interacting: boolean | undefined
  direction: Direction | undefined
}

export interface EventActionContextType {
  onInteractionStart: () => void
  onInteractionEnd: (Event?) => void
  onBeginAction: (
    event: Event,
    action: Action,
    pointerDate: Date | null,
    direction?: Direction
  ) => void
  dragAndDropAction?: DragDropAction

  eventState: EventState
  eventDispatch: React.Dispatch<ActionType>

  display: Display
  setDisplay: (display: Display) => void
  selectedDate: Date
  setSelectedDate: (date: Date) => void
}

export const EventActionContext = createContext<EventActionContextType>(undefined!)

/**
 * Handles events and CRUD actions on events.
 * TODO: Optimizations with caching and normalization.
 * TODO: Store the editingEvent data as a separate state so that all the calendar views
 *  (e.g. day columns) will not update.
 */

type EventDict = Record<string, Event>
type EditingEvent = {
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

type ActionType =
  | { type: 'RESET' }
  | { type: 'INIT_EVENTS'; payload: { eventsByCalendar: Record<string, Event[]> } }
  | { type: 'INIT_EDIT_EVENT'; payload: { event: Event; selectTailSegment?: boolean } }
  | {
      type: 'INIT_NEW_EVENT_AT_DATE'
      payload: { calendar: Calendar; date: Date; endDate?: Date; allDay: boolean }
    }
  | { type: 'CREATE_EVENT'; payload: Event }
  | {
      type: 'MOVE_EVENT_CALENDAR'
      payload: { prevCalendarId: string; newCalendarId: string; eventId: string }
    }
  | {
      type: 'DELETE_EVENT'
      payload: { calendarId: string; eventId: string; deleteMethod?: EditRecurringAction }
    }
  | { type: 'CANCEL_SELECT' }
  | {
      type: 'UPDATE_EVENT_ID'
      payload: { calendarId: string; prevEventId: string; newEventId: string }
    }
  | { type: 'UPDATE_EVENT'; payload: { calendarId: string; event: Event; replaceEventId: string } }
  | { type: 'UPDATE_EDIT_EVENT'; payload: Partial<Event> }
  | {
      type: 'UPDATE_EDIT_MODE'
      payload: { editMode: EditMode; editRecurringAction: EditRecurringAction }
    }

function eventReducer(state: EventState, action: ActionType) {
  const { eventsByCalendar } = state

  switch (action.type) {
    case 'RESET':
      return {
        ...state,
        loading: true,
      }

    case 'INIT_EVENTS':
      const calendarMap = action.payload.eventsByCalendar

      const normalizedMap: Record<string, EventDict> = {}
      for (const calendarId of Object.keys(calendarMap)) {
        normalizedMap[calendarId] = normalizeArr(calendarMap[calendarId], 'id')
      }

      return {
        ...state,
        loading: false,
        eventsByCalendar: normalizedMap,
      }

    /**
     * Starts editing an existing event.
     */
    case 'INIT_EDIT_EVENT':
      const { selectTailSegment } = action.payload
      return {
        ...state,
        editingEvent: {
          id: action.payload.event.id,
          originalCalendarId: action.payload.event.calendar_id,
          editMode: 'READ' as EditMode,
          event: action.payload.event,
          selectTailSegment: !!selectTailSegment,
          editRecurringAction: 'SINGLE' as EditRecurringAction,
        },
      }

    /**
     * Create new event from start date.
     * If the end date is not given, the default duration is 1h.
     */
    case 'INIT_NEW_EVENT_AT_DATE':
      const endDate =
        action.payload.endDate ||
        dates.add(action.payload.date, 1, action.payload.allDay ? 'day' : 'hours')

      const event = Event.newDefaultEvent(
        action.payload.calendar,
        action.payload.date,
        endDate,
        action.payload.allDay
      )

      return {
        ...state,
        editingEvent: {
          id: event.id,
          originalCalendarId: action.payload.calendar.id,
          editMode: 'EDIT' as EditMode,
          event,
          selectTailSegment: false,
          editRecurringAction: 'SINGLE' as EditRecurringAction,
        },
      }

    /**
     * Overrides an existing event. I.e. When the user create an event, we write a temporary event,
     * then override it when the server returns a successful response.
     */
    case 'UPDATE_EVENT':
      return produce(state, (stateDraft) => {
        const calendarId = action.payload.calendarId
        const replacedEventId = action.payload.replaceEventId

        // Only replace an existing event.
        if (stateDraft.eventsByCalendar[calendarId].hasOwnProperty(action.payload.event.id)) {
          for (let calId in stateDraft.eventsByCalendar) {
            if (stateDraft.eventsByCalendar[calId].hasOwnProperty(replacedEventId)) {
              delete stateDraft.eventsByCalendar[calId][replacedEventId]
            }
          }

          stateDraft.eventsByCalendar[calendarId][action.payload.event.id] = action.payload.event
        }
      })

    /**
     * Overrides an existing event ID when we get a successful response from the server
     * and sets the event to saved.
     */
    case 'UPDATE_EVENT_ID':
      return produce(state, (stateDraft) => {
        const calendarId = action.payload.calendarId
        const prevEventId = action.payload.prevEventId
        const newEventId = action.payload.newEventId

        const event = stateDraft.eventsByCalendar[calendarId][prevEventId]
        delete stateDraft.eventsByCalendar[calendarId][prevEventId]

        const updatedEvent = { ...event, syncStatus: 'SYNCED' as SyncStatus, id: newEventId }
        stateDraft.eventsByCalendar[calendarId][newEventId] = updatedEvent

        if (stateDraft.editingEvent?.id === prevEventId) {
          stateDraft.editingEvent.id = newEventId
          stateDraft.editingEvent.event.id = newEventId
          stateDraft.editingEvent.event.syncStatus = 'SYNCED'
        }
      })

    case 'CREATE_EVENT':
      return produce(state, (stateDraft) => {
        stateDraft.eventsByCalendar[action.payload.calendar_id][action.payload.id] = action.payload
      })

    /**
     * Moved an event from prevCalendarId to newCalendarId
     */
    case 'MOVE_EVENT_CALENDAR':
      return produce(state, (stateDraft) => {
        const prevCalendarId = action.payload.prevCalendarId
        const newCalendarId = action.payload.newCalendarId
        const eventId = action.payload.eventId

        const prevEvent = stateDraft.eventsByCalendar[prevCalendarId][eventId]
        if (prevEvent) {
          stateDraft.eventsByCalendar[newCalendarId][eventId] = prevEvent
          delete stateDraft.eventsByCalendar[prevCalendarId][eventId]
        } else {
          throw Error(`Event with id=${eventId} not found`)
        }
      })

    case 'DELETE_EVENT':
      const delEventId = action.payload.eventId
      const deleteMethod = action.payload.deleteMethod || 'SINGLE'

      if (deleteMethod === 'ALL') {
        return {
          ...state,
          eventsByCalendar: produce(eventsByCalendar, (draft) => {
            delete draft[action.payload.calendarId][delEventId]

            for (const event of Object.values(draft[action.payload.calendarId])) {
              if (event.recurring_event_id === delEventId) {
                delete draft[action.payload.calendarId][event.id]
              }
            }
          }),
        }
      } else {
        return {
          ...state,
          eventsByCalendar: produce(eventsByCalendar, (draft) => {
            delete draft[action.payload.calendarId][delEventId]
          }),
        }
      }

    case 'CANCEL_SELECT':
      return {
        ...state,
        editingEvent: null,
      }

    case 'UPDATE_EDIT_EVENT':
      if (!state.editingEvent) {
        return state
      } else {
        return {
          ...state,
          editingEvent: {
            ...state.editingEvent,
            event: { ...state.editingEvent.event, ...action.payload },
          },
        }
      }

    case 'UPDATE_EDIT_MODE':
      if (!state.editingEvent) {
        return state
      } else {
        return {
          ...state,
          editingEvent: {
            ...state.editingEvent,
            editMode: action.payload.editMode,
            editRecurringAction: action.payload.editRecurringAction,
          },
        }
      }

    default:
      throw new Error('Unknown action')
  }
}

export function EventActionProvider(props: any) {
  // Handles Drag & Drop Events.
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dragDropAction, setDragDropAction] = useState<DragDropAction | undefined>(undefined)
  const [display, setDisplay] = useState<Display>('Week')
  const [eventState, eventDispatch] = useReducer(eventReducer, {
    loading: true,
    eventsByCalendar: {},
    editingEvent: null,
  })

  function handleInteractionStart() {
    if (dragDropAction) {
      setDragDropAction({ ...dragDropAction, interacting: true })
    }
  }

  function handleInteractionEnd(event?: Event) {
    if (event) {
      eventDispatch({
        type: 'UPDATE_EVENT',
        payload: { calendarId: event.calendar_id, event, replaceEventId: event.id },
      })
    }

    setDragDropAction(undefined)
  }

  function handleBeginAction(
    event: Event,
    action: Action,
    pointerDate: Date | null,
    direction?: Direction
  ) {
    let interacting = dragDropAction?.interacting || false
    setDragDropAction({ event, action, direction, interacting, pointerDate })

    if (event.id !== eventState.editingEvent?.id) {
      eventDispatch({ type: 'CANCEL_SELECT' })
    }
  }

  const defaultContext: EventActionContextType = {
    onInteractionStart: handleInteractionStart,
    onInteractionEnd: handleInteractionEnd,
    dragAndDropAction: dragDropAction,
    onBeginAction: handleBeginAction,

    display,
    setDisplay,
    selectedDate,
    setSelectedDate,
    eventState,
    eventDispatch,
  }

  return (
    <EventActionContext.Provider value={defaultContext}>
      {props.children}
    </EventActionContext.Provider>
  )
}
