// TimezoneModal.js

import React from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from '@chakra-ui/react'
import TimezoneSelector from '../components/settings/TimezoneSelector'

const TimezoneModal = ({ isOpen, onClose, addTimezones, user }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select a Timezone</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <TimezoneSelector
            user={user}
            onUpdateTimezone={(tzCode) => {
              addTimezones(tzCode)
              onClose() // Close modal after adding
            }}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default TimezoneModal
