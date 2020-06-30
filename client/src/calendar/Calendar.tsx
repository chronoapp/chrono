import React, { useState, useEffect } from 'react'
import Week from './Week'
import Event from '../models/Event'
import * as dates from '../util/dates'
import { startOfWeek } from '../util/localizer'
import * as dateMath from 'date-arithmetic'

import {
  EventActionContext,
  EventActionContextType,
  DragDropAction,
  Action,
  Direction,
} from './EventActionContext'

function Calendar() {
  const firstOfWeek = startOfWeek()
  const start = dates.startOf(new Date(), 'week', firstOfWeek)

  const defaultEvents: Event[] = [
    new Event(
      1,
      'Do Laundry',
      dateMath.add(start, 10, 'hours'),
      dateMath.add(start, 11, 'hours'),
      false
    ),
    new Event(
      2,
      'Math HW',
      dateMath.add(start, 15, 'hours'),
      dateMath.add(start, 17, 'hours'),
      false
    ),
    new Event(
      3,
      'Work on ABC',
      dateMath.add(dateMath.add(start, 1, 'day'), 12, 'hours'),
      dateMath.add(dateMath.add(start, 1, 'day'), 15, 'hours'),
      false
    ),
  ]
  const [events, setEvents] = useState<Event[]>(defaultEvents)

  // Handles Drag & Drop Events.
  const [dragDropAction, setDragDropAction] = useState<DragDropAction | undefined>(undefined)

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey)

    return function cleanup() {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [])

  const defaultContext: EventActionContextType = {
    onStart: handleInteractionStart,
    onEnd: handleInteractionEnd,
    dragAndDropAction: dragDropAction,
    onBeginAction: handleBeginAction,

    onSelectNewEvent,
    onCancelSelection,
  }

  function handleEscapeKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancelSelection()
    }
  }

  function handleInteractionStart() {
    if (dragDropAction) {
      setDragDropAction({ ...dragDropAction, interacting: true })
    }
  }

  function handleBeginAction(event: Event, action: Action, direction?: Direction) {
    const interacting = dragDropAction ? dragDropAction.interacting : false
    setDragDropAction({ event, action, direction, interacting })
  }

  function handleInteractionEnd(event?: Event) {
    if (event) {
      const nextEvents = events.map((existingEvent) => {
        return existingEvent.id === event.id ? event : existingEvent
      })
      setEvents(nextEvents)
    }

    setDragDropAction(undefined)
  }

  function onSelectNewEvent(startDate: Date, endDate: Date) {
    const event = new Event(-1, '(New event)', startDate, endDate, true)
    const nextEvents = events.map((e) => e).filter((e) => e.id !== -1)
    nextEvents.push(event)
    setEvents(nextEvents)
  }

  function onCancelSelection() {
    const nextEvents = events
      .map((e) => {
        e.creating = false
        return e
      })
      .filter((e) => e.id !== -1)
    setEvents(nextEvents)
  }

  return (
    <div className="cal-calendar">
      <EventActionContext.Provider value={defaultContext}>
        <Week events={events} />
      </EventActionContext.Provider>
    </div>
  )
}

export default Calendar
