import React from 'react'
import produce from 'immer'
import { useRecoilValue } from 'recoil'

import {
  Box,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Stack,
  Text,
  Radio,
  RadioGroup,
} from '@chakra-ui/react'
import { Menu, MenuButton, MenuList, MenuItem, IconButton } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import { EventService } from './useEventService'
import Event from '@/models/Event'
import useEventActions from '@/state/useEventActions'
import { eventsState, EditRecurringAction, EventUpdateContext } from '@/state/EventsState'
import { getSplitRRules } from '@/calendar/utils/RecurrenceUtils'

import * as API from '@/util/Api'
import * as dates from '@/util/dates-luxon'
import { makeShortId } from '@/lib/js-lib/makeId'

interface IProps {
  event: Event // Event we are about to save.
  updateContext: EventUpdateContext
  eventService: EventService
}

/**
 * Modal that confirms the user wants to:
 * 1) Update a recurring event (single, all, this and following)
 * 2) Notify participants of the update.
 */
function ConfirmUpdateEventModal(props: IProps) {
  const eventActions = useEventActions()
  const events = useRecoilValue(eventsState)

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
      ? dates.add(parent.start, startOffset, 'minute')
      : dates.subtract(parent.start, startOffset, 'minute')

    const updatedEnd = dates.gte(child.end, originalChild.end)
      ? dates.add(parent.end, endOffset, 'minute')
      : dates.subtract(parent.end, endOffset, 'minute')

    return produce(parent, (event) => {
      event.title = child.title
      event.description = child.description
      event.labels = child.labels
      event.start = updatedStart
      event.end = updatedEnd
    })
  }

  async function updateAllRecurringEvents(parentEvent: Event | null, sendUpdates: boolean) {
    const parent =
      parentEvent || (await API.getEvent(props.event.calendar_id, props.event.recurring_event_id!))

    const originalChild = eventActions.getEvent(props.event.calendar_id, props.event.id)
    const updatedParent = getUpdatedParentEvent(parent, props.event, originalChild)

    // Delete all to refresh from the server.
    // TODO: Handle optimistic updates on the client to prevent flickering.
    eventActions.deleteEvent(updatedParent.calendar_id, updatedParent.id, 'ALL')

    return await props.eventService.saveEvent(updatedParent, sendUpdates)
  }

  /**
   * To update this event and all following events, we need to split the recurrence into:
   * 1) The recurrence up to this event. We then use the recurrence to update the parent event.
   * 2) The recurrence from this event onwards, to create a new series of events.
   */
  async function updateThisAndFutureRecurringEvents(sendUpdates: boolean) {
    const parent = await API.getEvent(props.event.calendar_id, props.event.recurring_event_id!)

    if (dates.eq(parent.start, props.event.original_start!)) {
      return await updateAllRecurringEvents(parent, sendUpdates)
    } else {
      // 1) Update the base event's recurrence, cut off at the current event's original start date.
      const rules = getSplitRRules(
        props.event.recurrences!.join('\n'),
        parent.start,
        props.event.original_start!,
        props.event.start,
        parent.all_day
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

  async function updateEvent(sendUpdates: boolean) {
    const isRecurringEvent = props.event.recurring_event_id != null
    if (isRecurringEvent) {
      if (!props.event.original_start) {
        throw Error('Recurring event does not have original_start')
      }

      if (radioValue === 'SINGLE') {
        return await props.eventService.saveEvent(props.event, sendUpdates)
      } else if (radioValue === 'ALL') {
        return await updateAllRecurringEvents(null, sendUpdates)
      } else if (radioValue === 'THIS_AND_FOLLOWING') {
        return await updateThisAndFutureRecurringEvents(sendUpdates)
      }
    } else {
      return await props.eventService.saveEvent(props.event, sendUpdates)
    }
  }

  function getHeader() {
    if (props.updateContext.isRecurringEvent) {
      return `Update recurring event: ${props.event.title}`
    } else {
      return `Update event: ${props.event.title}`
    }
  }

  function renderModalBody() {
    if (props.updateContext.hasParticipants && !props.updateContext.isRecurringEvent) {
      const originalEvent = events.eventsByCalendar[props.event.calendar_id][props.event.id]
      const { addedParticipants, removedParticipants } = Event.getParticipantUpdates(
        originalEvent,
        props.event
      )
      const newGuest = addedParticipants.length > 0
      const removedGuest = removedParticipants.length > 0

      if (newGuest && removedGuest) {
        return (
          <Text fontSize="sm">Would you like to send update emails to new and removed guests?</Text>
        )
      } else if (newGuest && !removedGuest) {
        return <Text fontSize="sm">Would you like to send invite emails new guests?</Text>
      } else if (!newGuest && removedGuest) {
        return (
          <Text fontSize="sm">Would you like to send cancellation emails to removed guests?</Text>
        )
      } else {
        return <Text fontSize="sm">Would you like to send update emails to existing guests?</Text>
      }
    } else {
      return (
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
      )
    }
  }

  function renderPrimaryAction() {
    if (props.updateContext.hasParticipants) {
      return (
        <Box>
          <Button
            size="sm"
            onClick={updateThenClose(true)}
            ref={initialFocusRef}
            colorScheme="primary"
            borderRightRadius={0}
          >
            Send update
          </Button>
          <Menu size="sm" gutter={2} placement="bottom-end">
            <MenuButton
              as={IconButton}
              aria-label="Options"
              icon={<FiChevronDown />}
              colorScheme="primary"
              borderLeftRadius={0}
              borderLeft={'1px solid'}
              borderLeftColor={'gray.400'}
            />
            <MenuList padding={0.5}>
              <MenuItem fontSize={'sm'} onClick={updateThenClose(false)}>
                Send update without email
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      )
    } else {
      return (
        <Button
          size="sm"
          onClick={updateThenClose(true)}
          ref={initialFocusRef}
          colorScheme="primary"
        >
          Save event
        </Button>
      )
    }
  }

  const updateThenClose = (sendUpdates: boolean) => () =>
    updateEvent(sendUpdates).then(() => onClose())

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
          {getHeader()}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>{renderModalBody()}</ModalBody>

        <ModalFooter>
          <Button colorScheme="gray" variant="ghost" size="sm" mr={4} onClick={onClose}>
            Cancel
          </Button>
          {renderPrimaryAction()}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfirmUpdateEventModal
