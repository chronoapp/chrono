import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalFooter,
  ModalBody,
  Text,
} from '@chakra-ui/react'

import { useRecoilState } from 'recoil'
import { userState } from '@/state/UserState'
import User from '@/models/User'
import * as API from '@/util/Api'

/**
 * Prompts the user to change their timezone if the local timezone
 * is different from the user's active timezone.
 */
export default function TimezoneChangePrompt() {
  const [user, setUser] = useRecoilState(userState)

  if (!user) {
    return null
  }

  // Never prompt if the user has disabled the prompt
  if (!user.flags.SHOULD_PROMPT_TIMEZONE_CHANGE) {
    return null
  }

  const userTimezone = User.getPrimaryTimezone(user)
  const hasPromptedBefore = user.flags.LAST_PROMPTED_TIMEZONE_TO_CHANGE === userTimezone

  // Don't prompt if the user has already been prompted to change to this timezone
  if (hasPromptedBefore) {
    return null
  }

  // Don't prompt if the user's timezone is the same as the local timezone
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  if (currentTimezone === userTimezone) {
    return null
  }

  function handlesYes(user: User) {
    const updatedTimezones = user.timezones.filter((tz) => tz !== userTimezone)
    updatedTimezones.unshift(currentTimezone)

    const updatedUser = {
      ...user,
      timezones: updatedTimezones,
      flags: { ...user.flags, LAST_PROMPTED_TIMEZONE_TO_CHANGE: userTimezone },
    }

    setUser(updatedUser)
    API.updateUser(updatedUser)
    API.updateUserFlags('LAST_PROMPTED_TIMEZONE_TO_CHANGE', userTimezone)
  }

  function handleNo(user: User) {
    const updatedUser = {
      ...user,
      flags: { ...user.flags, LAST_PROMPTED_TIMEZONE_TO_CHANGE: userTimezone },
    } as User

    setUser(updatedUser)
    API.updateUserFlags('LAST_PROMPTED_TIMEZONE_TO_CHANGE', userTimezone)
  }

  function handleNeverAskAgain(user: User) {
    const updatedUser = {
      ...user,
      flags: { ...user.flags, SHOULD_PROMPT_TIMEZONE_CHANGE: false },
    }

    setUser(updatedUser)
    API.updateUserFlags('SHOULD_PROMPT_TIMEZONE_CHANGE', userTimezone)
  }

  return (
    <Modal isOpen={true} onClose={() => {}} isCentered={true}>
      <ModalOverlay />
      <ModalContent>
        <ModalBody mt="4">
          <Text>
            Would you like to change your active timezone to <b>{currentTimezone}</b>?
          </Text>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="primary" mr={3} onClick={() => handlesYes(user)}>
            Yes
          </Button>
          <Button variant="ghost" onClick={() => handleNo(user)}>
            No
          </Button>
          <Button variant="ghost" onClick={() => handleNeverAskAgain(user)}>
            Never ask again
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
