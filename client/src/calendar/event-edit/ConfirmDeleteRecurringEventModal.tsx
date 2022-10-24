import React from 'react'

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

function ConfirmDeleteRecurringEventModal(props: { event: Event; eventService: EventService }) {
  const eventActions = useEventActions()
  const [radioValue, setRadioValue] = React.useState<EditRecurringAction>('SINGLE')

  const onClose = () => {
    eventActions.showConfirmDialog(undefined)
  }

  function deleteEvent() {
    if (radioValue === 'SINGLE') {
      props.eventService.deleteEvent(props.event.calendar_id, props.event.id)
    } else if (radioValue === 'THIS_AND_FOLLOWING') {
      props.eventService.deleteThisAndFollowingEvents(props.event)
    } else if (radioValue === 'ALL') {
      props.event.recurring_event_id &&
        props.eventService.deleteAllRecurringEvents(
          props.event.calendar_id,
          props.event.recurring_event_id
        )
    }

    onClose()
  }

  return (
    <Modal size="sm" isOpen={true} onClose={onClose} blockScrollOnMount={false}>
      <ModalOverlay />
      <ModalContent top="20%">
        <ModalHeader pb="2" fontSize="md">
          {`Delete recurring event: ${props.event.title}`}
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
          <Button size="sm" colorScheme={'red'} onClick={deleteEvent}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfirmDeleteRecurringEventModal
