import * as React from 'react'

import { useRecoilState } from 'recoil'
import { userState } from '@/state/UserState'
import {
  Flex,
  Box,
  Text,
  Button,
  Heading,
  Avatar,
  Input,
  useToast,
  ToastId,
} from '@chakra-ui/react'

import { InfoAlert } from '@/components/Alert'
import * as API from '@/util/Api'

function ProfileSettings() {
  const [user, setUser] = useRecoilState(userState)
  const [name, setName] = React.useState<string>(user?.name || '')
  const [username, setUsername] = React.useState<string>(user?.username || '')

  const toastIdRef = React.useRef<ToastId>()
  const toast = useToast()

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
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value)
  }

  const handleUpdate = () => {
    if (user) {
      setUser({ ...user, name: name, username: username })
      API.updateUser(user).then((res) => {
        addMessage('User profile updated.')
      })
    }
  }

  return (
    <>
      <Flex direction={'column'}>
        <Heading size="sm">Account Information</Heading>

        <Text fontSize="sm" mt="3" fontWeight={500}>
          Profile picture
        </Text>
        <Avatar src={user?.picture_url} mt="1" />

        <Text fontSize="sm" mt="3" fontWeight={500}>
          Email
        </Text>
        <Text fontSize="sm" color="gray.500">
          {user?.email}
        </Text>

        <Text fontSize="sm" mt="3" fontWeight={500}>
          Full name
        </Text>
        <Input size="sm" mt="1" placeholder="Full name" value={name} onChange={handleNameChange} />

        <Text fontSize="sm" mt="3" fontWeight={500}>
          Username
        </Text>
        <Input
          mt="1"
          size="sm"
          placeholder="Username"
          value={username}
          onChange={handleUsernameChange}
        />
      </Flex>

      <Button mt="4" colorScheme="primary" onClick={handleUpdate}>
        Update
      </Button>
    </>
  )
}

export default ProfileSettings
