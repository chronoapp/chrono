import { createContext, useReducer, useState } from 'react'
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
}

export const EventActionContext = createContext<EventActionContextType>(undefined!)

/**
 * Handles CRUD actions on events.
 * TODO: Optimizations with caching and normalization.
 */

export interface EventState {
  events: Event[]
}

type ActionType =
  | { type: 'INIT'; payload: Event[] }
  | { type: 'NEW_EVENT'; payload: { start: Date; end: Date } }
  | { type: 'CANCEL_SELECT' }
  | { type: 'UPDATE_EVENT'; payload: { event: Event } }

function eventReducer({ events }: EventState, action: ActionType) {
  switch (action.type) {
    case 'INIT':
      console.log(`INIT: ${action.payload.length} events.`)
      return {
        events: action.payload,
      }

    case 'NEW_EVENT':
      console.log('NEW_EVENT')
      const event = new Event(
        -1,
        null,
        action.payload.start,
        action.payload.end,
        true,
        false,
        '#7986CB',
        '#fff'
      )
      return {
        events: [...events, event],
      }
    case 'UPDATE_EVENT':
      console.log('UPDATE_EVENT')
      const e = action.payload.event
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === e.id ? e : existingEvent
      })
      return {
        events: nextEvents,
      }

    case 'CANCEL_SELECT':
      return {
        events: events.filter((e) => e.id !== -1),
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
      eventDispatch({ type: 'UPDATE_EVENT', payload: { event } })
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

    eventState,
    eventDispatch,
  }

  return (
    <EventActionContext.Provider value={defaultContext}>
      {props.children}
    </EventActionContext.Provider>
  )
}
