import { createContext, useReducer, useState } from 'react'
import update from 'immutability-helper'
import { normalizeArr } from '../lib/normalizer'

import * as dates from '../util/dates'
import Event from '../models/Event'

export type Action = 'MOVE' | 'RESIZE'
export type Direction = 'UP' | 'DOWN'
type EditMode = 'READ' | 'EDIT' | 'FULL_EDIT'

export interface DragDropAction {
  action: Action
  event: Event
  interacting: boolean | undefined
  direction: Direction | undefined
}

export interface EventActionContextType {
  onStart: () => void
  onEnd: (Event?) => void
  onBeginAction: (event: Event, action: Action, direction?: Direction) => void
  dragAndDropAction?: DragDropAction

  eventState: EventState
  eventDispatch: React.Dispatch<ActionType>

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

export interface EventState {
  loading: boolean
  eventsById: Record<number, Event>
  editingEvent: {
    id: number
    editMode: EditMode
    selectTailSegment: boolean
    event: Event
  } | null
}

type ActionType =
  | { type: 'INIT'; payload: Event[] }
  | { type: 'INIT_EDIT_NEW_EVENT'; payload: Event }
  | { type: 'INIT_EDIT_EVENT'; payload: { event: Event; selectTailSegment?: boolean } }
  | { type: 'INIT_NEW_EVENT_AT_DATE'; payload: { date: Date; allDay: boolean } }
  | { type: 'CREATE_EVENT'; payload: Event }
  | { type: 'DELETE_EVENT'; payload: { eventId: number } }
  | { type: 'CANCEL_SELECT' }
  | { type: 'UPDATE_EVENT'; payload: { event: Event; replaceEventId: number } }
  | { type: 'UPDATE_EDIT_EVENT'; payload: Event }
  | { type: 'UPDATE_EDIT_MODE'; payload: EditMode }

function eventReducer(state: EventState, action: ActionType) {
  const { eventsById } = state

  switch (action.type) {
    case 'INIT':
      console.log(`INIT: ${action.payload.length} events.`)
      return {
        ...state,
        loading: false,
        eventsById: normalizeArr(action.payload, 'id'),
      }

    case 'INIT_EDIT_NEW_EVENT':
      return {
        ...state,
        eventsById: { ...eventsById, [action.payload.id]: action.payload },
        editingEvent: {
          id: action.payload.id,
          editMode: 'EDIT' as EditMode,
          event: action.payload,
          selectTailSegment: false,
        },
      }

    case 'INIT_EDIT_EVENT':
      const { selectTailSegment } = action.payload
      return {
        ...state,
        eventsById: {
          ...update(eventsById, { $unset: [-1] }),
        },
        editingEvent: {
          id: action.payload.event.id,
          editMode: 'READ' as EditMode,
          event: action.payload.event,
          selectTailSegment: !!selectTailSegment,
        },
      }

    /**
     * Create new event from start date, for a default duration of 1h.
     */
    case 'INIT_NEW_EVENT_AT_DATE':
      const endDate = dates.add(action.payload.date, 1, action.payload.allDay ? 'day' : 'hours')
      const event = Event.newDefaultEvent(action.payload.date, endDate, action.payload.allDay)

      return {
        ...state,
        eventsById: { ...eventsById, [event.id]: event },
        editingEvent: {
          id: event.id,
          editMode: 'EDIT' as EditMode,
          event,
          selectTailSegment: false,
        },
      }

    /**
     * Overrides an existing event. I.e. When the user create an event, we write a temporary event,
     * then override it when the server returns a successful response.
     */
    case 'UPDATE_EVENT':
      return {
        ...state,
        eventsById: update(update(eventsById, { $unset: [action.payload.replaceEventId] }), {
          [action.payload.event.id]: { $set: action.payload.event },
        }),
      }

    case 'CREATE_EVENT':
      const eventsWithNew = update(eventsById, {
        [action.payload.id]: { $set: { ...action.payload } },
      })

      return {
        ...state,
        eventsById: eventsWithNew,
      }

    case 'DELETE_EVENT':
      const delEventId = action.payload.eventId
      return {
        ...state,
        eventsById: update(eventsById, { $unset: [delEventId] }),
      }

    case 'CANCEL_SELECT':
      let eventsUnselected = update(eventsById, { $unset: [-1] })

      return {
        ...state,
        eventsById: eventsUnselected,
        editingEvent: null,
      }

    case 'UPDATE_EDIT_EVENT':
      if (!state.editingEvent) {
        return state
      } else {
        return { ...state, editingEvent: { ...state.editingEvent, event: action.payload } }
      }

    case 'UPDATE_EDIT_MODE':
      if (!state.editingEvent) {
        return state
      } else {
        return { ...state, editingEvent: { ...state.editingEvent, editMode: action.payload } }
      }

    default:
      throw new Error('Unknown action')
  }
}

export function EventActionProvider(props: any) {
  // Handles Drag & Drop Events.
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dragDropAction, setDragDropAction] = useState<DragDropAction | undefined>(undefined)
  const [eventState, eventDispatch] = useReducer(eventReducer, {
    loading: true,
    eventsById: {},
    editingEvent: null,
  })

  function handleInteractionStart() {
    if (dragDropAction) {
      setDragDropAction({ ...dragDropAction, interacting: true })
    }
  }

  function handleInteractionEnd(event?: Event) {
    if (event) {
      eventDispatch({ type: 'UPDATE_EVENT', payload: { event, replaceEventId: event.id } })
    }

    setDragDropAction(undefined)
  }

  function handleBeginAction(event: Event, action: Action, direction?: Direction) {
    console.log('handleBeginAction')
    const interacting = dragDropAction ? dragDropAction.interacting : false
    setDragDropAction({ event, action, direction, interacting })
  }

  const defaultContext: EventActionContextType = {
    onStart: handleInteractionStart,
    onEnd: handleInteractionEnd,
    dragAndDropAction: dragDropAction,
    onBeginAction: handleBeginAction,

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
