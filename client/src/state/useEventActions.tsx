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
  ConfirmAction,
  EventState,
  EditingEvent,
} from '@/state/EventsState'

/**
 * Handles actions that modify the event state locally.
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
   * Handles new user with no events.
   */
  function initEmptyEvents() {
    setEvents((prevState) => {
      return {
        ...prevState,
        loading: false,
        eventsByCalendar: {
          ...prevState.eventsByCalendar,
        },
      }
    })
  }

  /**
   * Initializes all events.
   */
  function loadEvents(calendarId: string, events: Event[]) {
    setEvents((prevState) => {
      return {
        ...prevState,
        loading: false,
        eventsByCalendar: {
          ...prevState.eventsByCalendar,
          [calendarId]: normalizeArr(events, 'id'),
        },
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
      confirmAction: undefined,
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
   * To update a recurring event, we need to show a confirmation dialog
   * to ask the user if they want to update this / all / all future events.
   */
  function showConfirmDialog(action: ConfirmAction | undefined, updatedEvent: Event) {
    setEditingEvent((prevEditingEvent) => {
      if (prevEditingEvent) {
        return {
          ...prevEditingEvent,
          confirmAction: action,
          event: updatedEvent,
        }
      } else {
        return {
          id: updatedEvent.id,
          originalCalendarId: updatedEvent.calendar_id,
          editMode: 'MOVE_RESIZE' as EditMode,
          selectTailSegment: false,
          editRecurringAction: 'SINGLE' as EditRecurringAction,
          confirmAction: action,
          event: updatedEvent,
        } as EditingEvent
      }
    })
  }

  /**
   * 1) If the event had been resized or drag & dropped, we revert back to the original event.
   * 2) Otherwise, if we editing the event from a form, we close the confirm dialog so that
   * other fields could still be edited.
   */
  function hideConfirmDialog() {
    if (editingEvent?.editMode === 'MOVE_RESIZE') {
      setEditingEvent(null)
    } else {
      setEditingEvent((prevEditingEvent) => {
        if (prevEditingEvent) {
          return {
            ...prevEditingEvent,
            confirmAction: undefined,
          }
        }
        return null
      })
    }
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
   * Updates an existing event.
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
   * and sets the event to Synced.
   */
  function onSavedEventToServer(calendarId: string, eventId: string) {
    setEvents((prevState) => {
      return {
        ...prevState,
        eventsByCalendar: produce(prevState.eventsByCalendar, (eventsByCalendar) => {
          const event = eventsByCalendar[calendarId][eventId]
          const updatedEvent = { ...event, syncStatus: 'SYNCED' as SyncStatus, id: eventId }
          eventsByCalendar[calendarId][eventId] = updatedEvent
        }),
      }
    })

    setEditingEvent((editingEvent) => {
      if (editingEvent?.id === eventId) {
        return {
          ...editingEvent,
          event: {
            ...editingEvent.event,
            syncStatus: 'SYNCED',
          },
        }
      }
      return editingEvent
    })
  }

  function getEvent(calendarId: string, eventId: string) {
    return events.eventsByCalendar[calendarId]?.[eventId]
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
    const updatedEvents: EventState = {
      ...events,
      eventsByCalendar: produce(events.eventsByCalendar, (eventsByCalendar) => {
        const prevEvent = events.eventsByCalendar[prevCalendarId][eventId]

        if (prevEvent) {
          eventsByCalendar[newCalendarId][eventId] = prevEvent
          delete eventsByCalendar[prevCalendarId][eventId]
        } else {
          throw Error(`Event with id=${eventId} not found`)
        }
      }),
    }

    setEvents(updatedEvents)
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
      confirmAction: undefined,
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
    getEvent,
    initEvents,
    loadEvents,
    initEmptyEvents,
    initEditEvent,
    updateEditingEvent,
    updateEditMode,
    initNewEventAtDate,
    updateEvent,
    onSavedEventToServer,
    deleteEvent,
    moveEventCalendarAction,
    showConfirmDialog,
    hideConfirmDialog,

    cancelSelect,
    onInteractionStart,
    onInteractionEnd,
    onBeginAction,
  }
}

export type EventActionsType = ReturnType<typeof useEventActions>
