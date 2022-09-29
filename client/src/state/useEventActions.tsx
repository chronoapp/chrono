import { produce } from 'immer'
import { normalizeArr } from '@/lib/normalizer'
import { useRecoilState } from 'recoil'

import Event, { SyncStatus } from '@/models/Event'
import Calendar from '@/models/Calendar'
import * as dates from '@/util/dates'

import {
  dragDropActionState,
  eventsState,
  editingEventState,
  Action,
  EditRecurringAction,
  Direction,
  EventDict,
  EditMode,
} from '@/state/EventsState'

/**
 * Handles actions that modify the event state.
 * Includes Drag & Drop interactions.
 *
 */
export default function useEventActions() {
  const [events, setEvents] = useRecoilState(eventsState)
  const [editingEvent, setEditingEvent] = useRecoilState(editingEventState)
  const [dragDropAction, setDragDropAction] = useRecoilState(dragDropActionState)

  /**
   * Initializes all events.
   */
  function initEvents(calendarMap: Record<string, Event[]>) {
    const normalizedMap: Record<string, EventDict> = {}
    for (const calendarId of Object.keys(calendarMap)) {
      normalizedMap[calendarId] = normalizeArr(calendarMap[calendarId], 'id')
    }

    setEvents((prevState) => {
      return {
        ...prevState,
        loading: false,
        eventsByCalendar: normalizedMap,
      }
    })
  }

  /**
   * Starts editing an existing event.
   */
  function initEditEvent(event: Event, selectTailSegment = false) {
    setEditingEvent({
      id: event.id,
      originalCalendarId: event.calendar_id,
      editMode: 'READ' as EditMode,
      event: event,
      selectTailSegment: !!selectTailSegment,
      editRecurringAction: 'SINGLE' as EditRecurringAction,
    })
  }

  /**
   * Updates a currently editing event.
   */
  function updateEditingEvent(event: Partial<Event>) {
    setEditingEvent((prevState) => {
      if (prevState) {
        return {
          ...prevState,
          event: { ...prevState.event, ...event },
        }
      }
      return null
    })
  }

  /**
   * Switch edit mode between modal & popover.
   */
  function updateEditMode(editMode: EditMode, editRecurringAction: EditRecurringAction) {
    setEditingEvent((prevEditingEvent) => {
      if (prevEditingEvent) {
        return {
          ...prevEditingEvent,
          editMode: editMode,
          editRecurringAction: editRecurringAction,
        }
      }
      return null
    })
  }

  /**
   * Overrides an existing event. I.e. When the user creates an event, we write a temporary event,
   * then override it when the server returns a successful response.
   */
  function updateEvent(calendarId: string, replaceEventId: string, event: Event) {
    setEvents((prevState) => {
      return {
        ...prevState,
        eventsByCalendar: produce(prevState.eventsByCalendar, (eventsByCalendar) => {
          // Only replace an existing event.
          if (eventsByCalendar[calendarId].hasOwnProperty(event.id)) {
            for (let calId in eventsByCalendar) {
              if (eventsByCalendar[calId].hasOwnProperty(replaceEventId)) {
                delete eventsByCalendar[calId][replaceEventId]
              }
            }
            eventsByCalendar[calendarId][event.id] = event
          }
        }),
      }
    })
  }

  /**
   * Overrides an existing event ID when we get a successful response from the server
   * and sets the event to saved.
   */
  function replaceEventId(calendarId: string, prevEventId: string, newEventId: string) {
    setEvents((prevState) => {
      return {
        ...prevState,
        eventsByCalendar: produce(prevState.eventsByCalendar, (eventsByCalendar) => {
          const event = eventsByCalendar[calendarId][prevEventId]
          delete eventsByCalendar[calendarId][prevEventId]

          const updatedEvent = { ...event, syncStatus: 'SYNCED' as SyncStatus, id: newEventId }
          eventsByCalendar[calendarId][newEventId] = updatedEvent
        }),
      }
    })

    setEditingEvent((editingEvent) => {
      if (editingEvent?.id === prevEventId) {
        return {
          ...editingEvent,
          id: newEventId,
          event: {
            ...editingEvent.event,
            id: newEventId,
            syncStatus: 'SYNCED',
          },
        }
      }
      return editingEvent
    })
  }

  function deleteEvent(calendarId: string, eventId: string, deleteMethod?: EditRecurringAction) {
    const method = deleteMethod || 'SINGLE'

    if (method === 'ALL') {
      setEvents((prevState) => {
        return {
          ...prevState,
          eventsByCalendar: produce(prevState.eventsByCalendar, (draft) => {
            delete draft[calendarId][eventId]

            for (const event of Object.values(draft[calendarId])) {
              if (event.recurring_event_id === eventId) {
                delete draft[calendarId][event.id]
              }
            }
          }),
        }
      })
    } else {
      setEvents((prevState) => {
        return {
          ...prevState,
          eventsByCalendar: produce(prevState.eventsByCalendar, (draft) => {
            delete draft[calendarId][eventId]
          }),
        }
      })
    }
  }

  function moveEventCalendarAction(eventId: string, prevCalendarId: string, newCalendarId: string) {
    setEvents((prevState) => {
      return {
        ...prevState,
        calendarsById: produce(prevState.eventsByCalendar, (eventsByCalendar) => {
          const prevEvent = eventsByCalendar[prevCalendarId][eventId]
          if (prevEvent) {
            eventsByCalendar[newCalendarId][eventId] = prevEvent
            delete eventsByCalendar[prevCalendarId][eventId]
          } else {
            throw Error(`Event with id=${eventId} not found`)
          }
        }),
      }
    })
  }

  /**
   * Create new event from start date.
   * If the end date is not given, the default duration is 1h.
   */
  function initNewEventAtDate(
    calendar: Calendar,
    allDay: boolean,
    startDate: Date,
    endDate?: Date
  ) {
    const end = endDate || dates.add(startDate, 1, allDay ? 'day' : 'hours')
    const event = Event.newDefaultEvent(calendar, startDate, end, allDay)

    setEditingEvent({
      id: event.id,
      originalCalendarId: calendar.id,
      editMode: 'EDIT' as EditMode,
      event,
      selectTailSegment: false,
      editRecurringAction: 'SINGLE' as EditRecurringAction,
    })
  }

  function cancelSelect() {
    setEditingEvent(null)
  }

  function onInteractionStart() {
    if (dragDropAction) {
      setDragDropAction({ ...dragDropAction, interacting: true })
    }
  }

  function onInteractionEnd(event?: Event) {
    if (event) {
      updateEvent(event.calendar_id, event.id, event)
    }

    setDragDropAction(null)
  }

  function onBeginAction(
    event: Event,
    action: Action,
    pointerDate: Date | null,
    direction?: Direction
  ) {
    let interacting = dragDropAction?.interacting || false

    setDragDropAction({ event, action, direction, interacting, pointerDate })

    if (event.id !== editingEvent?.id) {
      cancelSelect()
    }
  }

  return {
    initEvents,
    initEditEvent,
    updateEditingEvent,
    updateEditMode,
    initNewEventAtDate,
    updateEvent,
    replaceEventId,
    deleteEvent,
    moveEventCalendarAction,

    cancelSelect,
    onInteractionStart,
    onInteractionEnd,
    onBeginAction,
  }
}

export type EventActionsType = ReturnType<typeof useEventActions>
