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
  Text,
  Box,
} from '@chakra-ui/react'
import { Menu, MenuButton, MenuList, MenuItem, IconButton } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import { EventService } from './useEventService'
import Event from '@/models/Event'
import useEventActions from '@/state/useEventActions'
import { EventUpdateContext } from '@/state/EventsState'

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
function ConfirmCreateEventModal(props: IProps) {
  const eventActions = useEventActions()
  const initialFocusRef = React.useRef(null)

  const onClose = () => {
    eventActions.hideConfirmDialog()
  }

  function createEvent(sendUpdates: boolean) {
    props.eventService.saveEvent(props.event, sendUpdates)
    onClose()
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
          {`Send invites for ${props.event.title}?`}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Text fontSize="sm">Would you like to send invitation emails to all guests?</Text>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="gray" variant="ghost" size="sm" mr={4} onClick={onClose}>
            Cancel
          </Button>
          <Box>
            <Button
              size="sm"
              onClick={() => createEvent(true)}
              ref={initialFocusRef}
              borderRightRadius={0}
              colorScheme="primary"
            >
              Send invites
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
              <MenuList>
                <MenuItem fontSize={'sm'} onClick={() => createEvent(false)}>
                  Send invites without email
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfirmCreateEventModal
