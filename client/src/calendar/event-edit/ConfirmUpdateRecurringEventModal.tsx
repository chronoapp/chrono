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
import { makeShortId } from '@/lib/js-lib/makeId'

interface IProps {
  event: Event
  eventService: EventService
}

function ConfirmUpdateRecurringEventModal(props: IProps) {
  const eventActions = useEventActions()
  const initialFocusRef = React.useRef(null)
  const [radioValue, setRadioValue] = React.useState<EditRecurringAction>('SINGLE')

  const onClose = () => {
    eventActions.hideConfirmDialog()
  }

  /**
   * Overrides the existing parent recurring event.
   */
  function getUpdatedParentEvent(parent: Event, child: Event, originalChild: Event) {
    const startOffset = dates.diff(child.start, originalChild.start, 'minutes')
    const endOffset = dates.diff(child.end, originalChild.end, 'minutes')

    const updatedStart = dates.gte(child.start, originalChild.start)
      ? dates.add(parent.start, startOffset, 'minutes')
      : dates.subtract(parent.start, startOffset, 'minutes')

    const updatedEnd = dates.gte(child.end, originalChild.end)
      ? dates.add(parent.end, endOffset, 'minutes')
      : dates.subtract(parent.end, endOffset, 'minutes')

    return produce(parent, (event) => {
      event.title = child.title
      event.description = child.description
      event.labels = child.labels
      event.start = updatedStart
      event.end = updatedEnd
    })
  }

  async function updateAllRecurringEvents(parentEvent?: Event) {
    const parent =
      parentEvent || (await API.getEvent(props.event.calendar_id, props.event.recurring_event_id!))

    const originalChild = eventActions.getEvent(props.event.calendar_id, props.event.id)
    const updatedParent = getUpdatedParentEvent(parent, props.event, originalChild)

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
    const parent = await API.getEvent(props.event.calendar_id, props.event.recurring_event_id!)

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
        id: makeShortId(),
        recurrences: [rules.end.toString()],
        recurring_event_id: null,
        syncStatus: 'NOT_SYNCED',
      }
      const req2 = props.eventService.saveEvent(thisAndFollowingEvent, false)

      // UI: Clear recurring events from the client.
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
    <Modal
      size="sm"
      isOpen={true}
      onClose={onClose}
      blockScrollOnMount={false}
      initialFocusRef={initialFocusRef}
    >
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
          <Button size="sm" onClick={updateThenClose} ref={initialFocusRef}>
            Update
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfirmUpdateRecurringEventModal
