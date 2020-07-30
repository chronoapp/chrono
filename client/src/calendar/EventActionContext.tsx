import { createContext, useReducer, useState } from 'react'
import update from 'immutability-helper'
import { normalizeArr } from '../lib/normalizer'

import Event from '../models/Event'

export type Action = 'MOVE' | 'RESIZE'
export type Direction = 'UP' | 'DOWN'

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
 */

export interface EventState {
  loading: boolean
  eventsById: Record<number, Event>
  editingEventId: number | null
}

type ActionType =
  | { type: 'INIT'; payload: Event[] }
  | { type: 'INIT_EDIT_NEW_EVENT'; payload: Event }
  | { type: 'INIT_EDIT_EVENT'; payload: Event }
  | { type: 'CREATE_EVENT'; payload: Event }
  | { type: 'DELETE_EVENT'; payload: { eventId: number } }
  | { type: 'CANCEL_SELECT' }
  | { type: 'UPDATE_EVENT'; payload: { event: Event; replaceEventId: number } }

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
        editingEventId: action.payload.id,
      }

    case 'INIT_EDIT_EVENT':
      return {
        ...state,
        eventsById: { ...eventsById, [action.payload.id]: action.payload },
        editingEventId: action.payload.id,
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
        editingEventId: null,
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
    editingEventId: null,
  })

  function handleInteractionStart() {
    console.log('handleInteractionStart')
    if (dragDropAction) {
      setDragDropAction({ ...dragDropAction, interacting: true })
    }
  }

  function handleInteractionEnd(event?: Event) {
    console.log('handleInteractionEnd')
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
