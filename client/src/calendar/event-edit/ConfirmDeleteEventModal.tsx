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
  Text,
  Box,
} from '@chakra-ui/react'
import { Menu, MenuButton, MenuList, MenuItem, IconButton } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import { EventService } from './useEventService'
import Event from '@/models/Event'
import useEventActions from '@/state/useEventActions'
import { EditRecurringAction, EventUpdateContext } from '@/state/EventsState'

interface IProps {
  event: Event // Event we are about to save.
  updateContext: EventUpdateContext
  eventService: EventService
}

/**
 * Modal that confirms the user wants to:
 * 1) Delete a recurring event: (single, all, or this and following)
 * 2) Notify participants of the delete.
 */
function ConfirmDeleteRecurringEventModal(props: IProps) {
  const eventActions = useEventActions()
  const [radioValue, setRadioValue] = React.useState<EditRecurringAction>('SINGLE')
  const initialFocusRef = React.useRef(null)

  const onClose = () => {
    eventActions.hideConfirmDialog()
  }

  function deleteEvent(sendUpdates: boolean) {
    if (radioValue === 'SINGLE') {
      props.eventService.deleteEvent(props.event.calendar_id, props.event.id, 'SINGLE', sendUpdates)
    } else if (radioValue === 'THIS_AND_FOLLOWING') {
      props.eventService.deleteThisAndFollowingEvents(props.event, sendUpdates)
    } else if (radioValue === 'ALL') {
      props.event.recurring_event_id &&
        props.eventService.deleteAllRecurringEvents(
          props.event.calendar_id,
          props.event.recurring_event_id,
          sendUpdates
        )
    }

    onClose()
  }

  function getHeader() {
    if (props.updateContext.isRecurringEvent) {
      return `Delete recurring event: ${props.event.title}`
    } else {
      return `Delete event: ${props.event.title}`
    }
  }

  function renderModalBody() {
    if (props.updateContext.hasParticipants && !props.updateContext.isRecurringEvent) {
      return (
        <Text fontSize="sm">
          Would you like to delete the event and send update emails to existing guests?
        </Text>
      )
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

  /**
   * If there are participants, there is a choice to send updates
   * as part of a dropdown.
   */
  function renderPrimaryAction() {
    if (props.updateContext.hasParticipants) {
      return (
        <Box>
          <Button
            size="sm"
            onClick={() => deleteEvent(true)}
            ref={initialFocusRef}
            borderRightRadius={0}
            colorScheme="red"
          >
            Delete event
          </Button>
          <Menu size="sm" gutter={2} placement="bottom-end">
            <MenuButton
              as={IconButton}
              aria-label="Options"
              icon={<FiChevronDown />}
              colorScheme="red"
              borderLeftRadius={0}
              borderLeft={'1px solid'}
              borderLeftColor={'gray.200'}
            />
            <MenuList padding={0.5}>
              <MenuItem fontSize={'sm'} onClick={() => deleteEvent(false)}>
                Delete event without sending email
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
      )
    } else {
      return (
        <Button
          size="sm"
          colorScheme={'red'}
          onClick={() => deleteEvent(true)}
          ref={initialFocusRef}
        >
          Delete event
        </Button>
      )
    }
  }

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

export default ConfirmDeleteRecurringEventModal
