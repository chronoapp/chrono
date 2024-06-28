import React, { useState, useCallback } from 'react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverCloseButton,
  IconButton,
} from '@chakra-ui/react'
import { useRecoilState } from 'recoil'
import User from '@/models/User'
import TimezoneSelector from '../components/settings/TimezoneSelector'
import * as API from '@/util/Api'
import { userState } from '@/state/UserState'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'

const TimezonePopover = ({ isOpen, onOpen, onClose, addTimezones }) => {
  const [user, setUser] = useRecoilState(userState)

  const handleUpdateTimezone = useCallback(
    (timezone) => {
      const updatedTimezones = [...user!.timezones, timezone]
      const updatedUser = {
        ...user,
        timezones: updatedTimezones,
      } as User
      addTimezones(timezone)
      setUser(updatedUser)
      API.updateUser(updatedUser)
        .then(() => {
          onClose()
        })
        .catch((error) => {
          console.error('Failed to update user timezones:', error)
        })
    },
    [user, addTimezones, onClose, setUser]
  )

  return (
    <Popover isOpen={isOpen} onClose={onClose} placement="bottom-end">
      <PopoverTrigger>
        <IconButton
          size={'xs'}
          variant="ghost"
          aria-label="adding additional timezones"
          icon={<FiPlus />}
          width="4"
          onClick={onOpen}
        />
      </PopoverTrigger>
      <PopoverContent width="350px" marginLeft="50px" boxShadow="lg">
        <PopoverCloseButton />
        <PopoverBody>
          <TimezoneSelector user={user!} onUpdateTimezone={handleUpdateTimezone} />
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

export default TimezonePopover
