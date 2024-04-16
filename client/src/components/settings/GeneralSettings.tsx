import * as React from 'react'
import { useRecoilState } from 'recoil'

import { Flex, Heading, useToast, ToastId } from '@chakra-ui/react'

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

      <TimezoneSelector
        user={user}
        onUpdateTimezone={(timezone) => {
          const updatedUser = { ...user, timezones: [timezone] }
          setUser(updatedUser)
          API.updateUser(updatedUser)
        }}
      />
      <CalendarSettings user={user} onUpdateUser={setUser} addMessage={addMessage} />
      <ConferencingSettings user={user} onUpdateUser={setUser} addMessage={addMessage} />
    </Flex>
  )
}

export default GeneralSettings
