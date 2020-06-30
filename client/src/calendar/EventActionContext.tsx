import { createContext } from 'react'
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

  // Event Creation
  onSelectNewEvent: (start: Date, end: Date) => void
  onCancelSelection: () => void
}

export const EventActionContext = createContext<EventActionContextType>(undefined!)
