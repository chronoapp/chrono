// TimezoneModal.js
import React, { useState, useCallback } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from '@chakra-ui/react'
import TimezoneSelector from '../components/settings/TimezoneSelector'
import * as API from '@/util/Api'

const TimezoneModal = ({ isOpen, onClose, addTimezones, user }) => {
  const [timezones, setTimezones] = useState(user.timezones || [])
  /**
   * Handles the addition of a new timezone to the user's timezone list.
   * Updates the local front-end timezone state and the user's back-end timezone list.
   */
  const handleUpdateTimezone = useCallback(
    (timezone) => {
      const updatedTimezones = [...timezones, timezone]
      setTimezones(updatedTimezones)
      const updatedUser = {
        ...user,
        timezones: updatedTimezones,
      }

      API.updateUser(updatedUser)
        .then(() => {
          addTimezones(timezone)
          onClose()
        })
        .catch((error) => {
          console.error('Failed to update user timezones:', error)
        })
    },
    [timezones, user, addTimezones, onClose]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Select a Timezone</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <TimezoneSelector user={user} onUpdateTimezone={handleUpdateTimezone} />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default TimezoneModal
