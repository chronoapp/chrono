import { createContext, useReducer, useState } from 'react'
import Event from '../models/Event'
import { createEvent, getAuthToken } from '../util/Api'

export type Action = 'MOVE' | 'RESIZE'
export type Direction = 'UP' | 'DOWN'

export interface DragDropAction {
  action: Action
  event: Event
  interacting: boolean | undefined
  direction: Direction | undefined
}

interface EventActionContextType {
  onStart: () => void
  onEnd: (Event?) => void
  onBeginAction: (event: Event, action: Action, direction?: Direction) => void
  dragAndDropAction?: DragDropAction

  eventState: EventState
  eventDispatch: React.Dispatch<ActionType>
}

export const EventActionContext = createContext<EventActionContextType>(undefined!)

/**
 * Handles CRUD actions on events.
 * TODO: Optimizations with caching and normalization.
 */

export interface EventState {
  events: Event[]
  loading: boolean
}

type ActionType =
  | { type: 'START_LOAD' }
  | { type: 'INIT'; payload: Event[] }
  | { type: 'NEW_EVENT'; payload: { start: Date; end: Date } }
  | { type: 'CREATE_EVENT'; payload: Event }
  | { type: 'CANCEL_SELECT' }
  | { type: 'UPDATE_EVENT'; payload: Event }

function eventReducer({ events, loading }: EventState, action: ActionType) {
  switch (action.type) {
    case 'START_LOAD':
      console.log('START_LOAD')
      return {
        loading: true,
        events: events || [],
      }

    case 'INIT':
      console.log(`INIT: ${action.payload.length} events.`)
      return {
        events: action.payload,
        loading: false,
      }

    case 'NEW_EVENT':
      console.log('NEW_EVENT')
      const event = Event.newDefaultEvent(action.payload.start, action.payload.end)
      return {
        events: [...events, event],
        loading,
      }

    case 'UPDATE_EVENT':
      console.log('UPDATE_EVENT')
      const e = action.payload
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === e.id ? e : existingEvent
      })
      return {
        events: nextEvents,
        loading,
      }

    case 'CREATE_EVENT':
      // TODO: Normalize the data
      const updated = events.map((e) => {
        if (action.payload.id === e.id) {
          action.payload.creating = false
          return action.payload
        } else {
          return e
        }
      })

      const token = getAuthToken()
      createEvent(token, action.payload).then((r) => {
        console.log('RESULT')
        console.log(r)
      })

      return {
        events: updated,
        loading,
      }

    case 'CANCEL_SELECT':
      return {
        events: events.filter((e) => e.id !== -1),
        loading,
      }
    default:
      throw new Error('Unknown action')
  }
}

export function EventActionProvider(props: any) {
  // Handles Drag & Drop Events.
  const [dragDropAction, setDragDropAction] = useState<DragDropAction | undefined>(undefined)
  const [eventState, eventDispatch] = useReducer(eventReducer, {
    events: [],
    loading: false,
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
      eventDispatch({ type: 'UPDATE_EVENT', payload: event })
    }

    setDragDropAction(undefined)
  }

  function handleBeginAction(event: Event, action: Action, direction?: Direction) {
    console.log('handleBeginAction')
    const interacting = dragDropAction ? dragDropAction.interacting : false
    const e = Object.assign({}, event)
    setDragDropAction({ event: e, action, direction, interacting })
  }

  const defaultContext: EventActionContextType = {
    onStart: handleInteractionStart,
    onEnd: handleInteractionEnd,
    dragAndDropAction: dragDropAction,
    onBeginAction: handleBeginAction,

    eventState,
    eventDispatch,
  }

  return (
    <EventActionContext.Provider value={defaultContext}>
      {props.children}
    </EventActionContext.Provider>
  )
}
