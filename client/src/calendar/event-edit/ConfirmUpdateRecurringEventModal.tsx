import React from 'react'
import produce from 'immer'

import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Stack,
  Radio,
  RadioGroup,
} from '@chakra-ui/react'

import { EventService } from './useEventService'
import Event from '@/models/Event'
import useEventActions from '@/state/useEventActions'
import { EditRecurringAction } from '@/state/EventsState'
import { getSplitRRules } from '@/calendar/utils/RecurrenceUtils'

import * as API from '@/util/Api'
import * as dates from '@/util/dates'

function ConfirmUpdateRecurringEventModal(props: { event: Event; eventService: EventService }) {
  const eventActions = useEventActions()
  const [radioValue, setRadioValue] = React.useState<EditRecurringAction>('SINGLE')

  const onClose = () => {
    eventActions.showConfirmDialog(undefined)
  }

  /**
   * Overrides the existing parent recurring event.
   */
  function getUpdatedParentEvent(parent: Event, child: Event) {
    // FIXME: Update event start / end based on the offsets.
    return produce(parent, (event) => {
      event.title = child.title
      event.description = child.description
      event.labels = child.labels
    })
  }

  async function updateAllRecurringEvents(parentEvent?: Event) {
    const parent =
      parentEvent ||
      (await API.getEvent(
        API.getAuthToken(),
        props.event.calendar_id,
        props.event.recurring_event_id!
      ))

    const updatedParent = getUpdatedParentEvent(parent, props.event)

    // Delete all to refresh from the server.
    // TODO: Handle optimistic updates on the client to prevent flickering.
    eventActions.deleteEvent(updatedParent.calendar_id, updatedParent.id, 'ALL')

    return await props.eventService.saveEvent(updatedParent)
  }

  async function updateThisAndFutureRecurringEvents() {
    /**
     * To update this event and all following events, we need to split the recurrence into:
     * 1) The recurrence up to this event. We then use the recurrence to update the parent event.
     * 2) The recurrence from this event onwards, to create a new series of events.
     */
    const parent = await API.getEvent(
      API.getAuthToken(),
      props.event.calendar_id,
      props.event.recurring_event_id!
    )

    if (dates.eq(parent.start, props.event.original_start)) {
      return await updateAllRecurringEvents(parent)
    } else {
      // 1) Update the base event's recurrence, cut off at the current event's original start date.
      const rules = getSplitRRules(
        props.event.recurrences!.join('\n'),
        parent.start,
        props.event.original_start!
      )

      const updatedParentOriginal = { ...parent, recurrences: [rules.start.toString()] }
      const req1 = props.eventService.saveEvent(updatedParentOriginal, false)

      // 2) Create a new recurring event for the the rest of the events
      const thisAndFollowingEvent: Event = {
        ...props.event,
        recurrences: [rules.end.toString()],
        recurring_event_id: null,
        syncStatus: 'NOT_SYNCED',
      }
      const req2 = props.eventService.saveEvent(thisAndFollowingEvent, false)

      // Clear recurring events from the client.
      eventActions.deleteEvent(parent.calendar_id, parent.id, 'ALL')

      return await Promise.all([req1, req2])
    }
  }

  async function updateEvent() {
    if (!props.event.recurring_event_id || !props.event.original_start) {
      throw Error('Could not find recurring event')
    }

    if (radioValue === 'SINGLE') {
      return await props.eventService.saveEvent(props.event)
    } else if (radioValue === 'ALL') {
      return await updateAllRecurringEvents()
    } else if (radioValue === 'THIS_AND_FOLLOWING') {
      return await updateThisAndFutureRecurringEvents()
    }
  }

  const updateThenClose = () => updateEvent().then(() => onClose())

  return (
    <Modal size="sm" isOpen={true} onClose={onClose} blockScrollOnMount={false}>
      <ModalOverlay />
      <ModalContent top="20%">
        <ModalHeader pb="2" fontSize="md">
          {`Update recurring event: ${props.event.title}`}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <RadioGroup
            onChange={(val) => {
              setRadioValue(val as EditRecurringAction)
            }}
            value={radioValue}
          >
            <Stack>
              <Radio size="sm" value={'SINGLE'}>
                This event
              </Radio>
              <Radio size="sm" value={'THIS_AND_FOLLOWING'}>
                This and following events
              </Radio>
              <Radio size="sm" value={'ALL'}>
                All events
              </Radio>
            </Stack>
          </RadioGroup>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="gray" variant="ghost" size="sm" mr={4} onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={updateThenClose}>
            Update
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfirmUpdateRecurringEventModal
