import * as React from 'react'
import { useRecoilState } from 'recoil'

import { Flex, Heading, useToast, ToastId, Checkbox } from '@chakra-ui/react'

import { userState } from '@/state/UserState'
import { InfoAlert } from '@/components/Alert'

import * as API from '@/util/Api'
import CalendarSettings from './CalendarSettings'
import ConferencingSettings from './ConferencingSettings'
import TimezoneSelector from './TimezoneSelector'

function GeneralSettings() {
  const [user, setUser] = useRecoilState(userState)
  const toastIdRef = React.useRef<ToastId>()
  const toast = useToast()

  React.useEffect(() => {
    // Handle the oauth response from the popup window
    function handleOauthComplete(event) {
      if (event.data.type === 'googleOAuthResponse') {
        API.getUser().then((user) => {
          setUser(user)
        })
      }
    }

    window.addEventListener('message', handleOauthComplete)

    return () => {
      window.removeEventListener('message', handleOauthComplete)
    }
  }, [])

  if (!user) {
    return null
  }

  function addMessage(title: string) {
    toastIdRef.current && toast.close(toastIdRef.current)
    toastIdRef.current = toast({
      title: title,
      duration: 3000,
      render: (p) => {
        return <InfoAlert onClose={p.onClose} title={title} />
      },
    })
  }

  return (
    <Flex direction={'column'} width={'100%'}>
      <Heading size="sm">General</Heading>

      {/* Enable / disable tags plugin */}
      <Checkbox
        mt="2"
        fontSize={'sm'}
        size="sm"
        isChecked={!user.flags.DISABLE_TAGS}
        onChange={(e) => {
          const disableTags = !e.target.checked
          const flags = { ...user.flags, DISABLE_TAGS: disableTags }
          setUser({ ...user, flags: flags })
          API.updateUserFlags('DISABLE_TAGS', disableTags)
        }}
      >
        Enable tags
      </Checkbox>

      {/* Enable / disable prompt for prompting timezone changes */}
      <Checkbox
        mt="2"
        fontSize={'sm'}
        size="sm"
        isChecked={user.flags.SHOULD_PROMPT_TIMEZONE_CHANGE}
        onChange={(e) => {
          const enableTimezonePrompt = e.target.checked
          const flags = { ...user.flags, SHOULD_PROMPT_TIMEZONE_CHANGE: enableTimezonePrompt }

          setUser({ ...user, flags: flags })
          API.updateUserFlags('SHOULD_PROMPT_TIMEZONE_CHANGE', enableTimezonePrompt)
        }}
      >
        Ask to update primary timezone when it changes
      </Checkbox>

      <TimezoneSelector
        user={user}
        onUpdateTimezone={(timezone) => {
          // Don't prompt the user to update their timezone again.
          const flags = { ...user.flags, LAST_PROMPTED_TIMEZONE_TO_CHANGE: timezone }
          const updatedUser = { ...user, flags: flags, timezones: [timezone] }
          setUser(updatedUser)

          API.updateUser(updatedUser)
          API.updateUserFlags('LAST_PROMPTED_TIMEZONE_TO_CHANGE', timezone)
        }}
      />
      <CalendarSettings user={user} onUpdateUser={setUser} addMessage={addMessage} />
      <ConferencingSettings user={user} onUpdateUser={setUser} addMessage={addMessage} />
    </Flex>
  )
}

export default GeneralSettings
