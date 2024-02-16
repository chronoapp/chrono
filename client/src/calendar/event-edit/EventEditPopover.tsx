import { useState } from 'react'
import { useRecoilValue } from 'recoil'

import { Box, useToast } from '@chakra-ui/react'
import produce from 'immer'

import Event from '@/models/Event'
import Calendar from '@/models/Calendar'
import EventParticipant, { ResponseStatus } from '@/models/EventParticipant'
import { InfoAlert } from '@/components/Alert'

import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { editingEventState, EventUpdateContext } from '@/state/EventsState'
import { userState } from '@/state/UserState'
import { EventService } from './useEventService'
import EventFields from './EventFields'
import EventEditReadOnly from './EventEditReadOnly'
import EventEditPartial from './EventEditPartial'

interface IProps {
  event: Event
  eventService: EventService
}

function EventPopover(props: IProps) {
  const eventActions = useEventActions()
  const editingEvent = useRecoilValue(editingEventState)
  const toast = useToast()

  const calendarsById = useRecoilValue(calendarsState).calendarsById
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const selectedCalendar = getSelectedCalendar(props.event.calendar_id)

  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      selectedCalendar?.id,
      props.event.all_day,
      props.event.start_day,
      props.event.end_day,
      props.event.organizer,
      props.event.recurrences ? props.event.recurrences.join('\n') : null,
      props.event.guests_can_modify,
      props.event.guests_can_invite_others,
      props.event.guests_can_see_other_guests,
      props.event.conference_data,
      props.event.location,
      props.event.visibility,
      props.event.transparency,
      props.event.use_default_reminders,
      props.event.reminders
    )
  )
  const [participants, setParticipants] = useState<EventParticipant[]>(props.event.participants)
  const thisUser = useRecoilValue(userState)

  const myself = participants.find(
    (p) => p.email === thisUser?.email || p.email === selectedCalendar.email
  )

  const isReadOnly = editingEvent?.editMode == 'READ'

  return (
    <Box boxShadow="xl" borderRadius={'md'} pt="1" pb="1" textAlign={'left'}>
      {isReadOnly ? (
        <EventEditReadOnly
          event={props.event}
          selectedCalendar={getSelectedCalendar(eventFields.calendarId)}
          eventFields={eventFields}
          participants={participants}
          myself={myself}
          onDeleteEvent={onDeleteEvent}
          onClickEdit={() => {
            eventActions.updateEditingEvent(getUpdatedEvent(props.event, eventFields, participants))
            eventActions.updateEditMode('FULL_EDIT')
          }}
          onClose={eventActions.cancelSelect}
          onUpdateResponse={onUpdateResponse}
        />
      ) : (
        <EventEditPartial
          event={props.event}
          eventFields={eventFields}
          selectedCalendar={getSelectedCalendar(eventFields.calendarId)}
          participants={participants}
          setEventFields={(eventFields: EventFields) => {
            // Update the mutable event fields and update the editing event.
            setEventFields(eventFields)
            eventActions.updateEditingEvent(getUpdatedEvent(props.event, eventFields, participants))
          }}
          setParticipants={(participants: EventParticipant[]) => {
            setParticipants(participants)
            eventActions.updateEditingEvent(getUpdatedEvent(props.event, eventFields, participants))
          }}
          onSaveEvent={() => {
            onSaveEvent({
              ...getUpdatedEvent(props.event, eventFields, participants),
            })
          }}
          onCancel={props.eventService.discardEditingEvent}
          onClickMoreOptions={() => {
            eventActions.updateEditingEvent({
              ...getUpdatedEvent(props.event, eventFields, participants),
            })
            eventActions.updateEditMode('FULL_EDIT')
          }}
        />
      )}
    </Box>
  )

  /**
   * This could only be a new event. Show a confirmation dialog if the event has participants.
   */
  async function onSaveEvent(updatedEvent: Event) {
    const hasParticipants = Event.hasNonOrganizerParticipants(updatedEvent)

    if (hasParticipants) {
      const updateContext = {
        eventEditAction: 'CREATE',
        isRecurringEvent: undefined,
        hasParticipants: hasParticipants,
      } as EventUpdateContext

      eventActions.updateEditingEvent(updatedEvent)
      eventActions.showConfirmDialog(updateContext, updatedEvent)
    } else {
      // Update the individual event directly.
      return await props.eventService.saveEvent(updatedEvent)
    }
  }

  function onDeleteEvent() {
    const isRecurringEvent = props.event.recurring_event_id !== null
    const hasParticipants = Event.hasNonOrganizerParticipants(props.event)
    const showConfirmDialog = hasParticipants || isRecurringEvent

    if (showConfirmDialog) {
      const updateContext = {
        eventEditAction: 'DELETE',
        isRecurringEvent: isRecurringEvent,
        hasParticipants: hasParticipants,
      } as EventUpdateContext

      eventActions.showConfirmDialog(updateContext, props.event)
    } else {
      props.eventService.deleteEvent(props.event.calendar_id, props.event.id, 'SINGLE', false)
    }
  }

  function getUpdatedEvent(
    e: Event,
    fields: EventFields,
    eventParticipants: EventParticipant[]
  ): Event {
    return {
      ...e,
      ...EventFields.getMutableEventFields(fields),
      participants: eventParticipants,
    }
  }

  function getSelectedCalendar(calendarId: string): Calendar {
    const calendar = calendarsById[calendarId]
    if (calendar) {
      return calendar
    } else {
      return primaryCalendar!
    }
  }

  /**
   * Updates the response status of the current user,
   * without sending an email to notify participants.
   */
  function onUpdateResponse(responseStatus: ResponseStatus) {
    if (!myself) {
      return
    }

    const updatedParticipants = produce(participants, (draft) => {
      const me = draft.find((p) => p.email === myself.email)
      if (me) {
        me.response_status = responseStatus
      }
    })

    setParticipants(updatedParticipants)
    let responseText = ''
    if (responseStatus === 'accepted') {
      responseText = 'Accepted'
    } else if (responseStatus === 'declined') {
      responseText = 'Declined'
    } else if (responseStatus === 'tentative') {
      responseText = 'Tentatively accepted'
    }

    const updatedEvent = getUpdatedEvent(props.event, eventFields, updatedParticipants)
    eventActions.updateEditingEvent(updatedEvent)
    props.eventService.saveEvent(updatedEvent, false, false)

    if (responseText) {
      toast({
        render: (p) => {
          return (
            <InfoAlert
              onClose={p.onClose}
              title={`${responseText} invite to ${props.event.title_short}`}
            />
          )
        },
      })
    }
  }
}

export default EventPopover
