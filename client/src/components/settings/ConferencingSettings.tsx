import { FiTrash } from 'react-icons/fi'
import { Image, IconButton } from '@chakra-ui/react'
import { Flex, Box, Text, Button, Heading } from '@chakra-ui/react'

import GoogleMeetLogo from '@/assets/google-meet.svg'
import ZoomLogo from '@/assets/zoom-app.svg'

import User, { VideoMeetType } from '@/models/User'
import * as API from '@/util/Api'
import ZoomConnection from '@/models/ZoomConnection'

export default function ConferencingSettings(props: {
  user: User
  addMessage: (message: string) => void
  onUpdateUser: (user: User) => void
}) {
  const { user } = props

  function renderConferenceType(type: VideoMeetType) {
    if (type === 'zoom') {
      return (
        <Flex alignItems="center">
          <Image width={'20px'} src={ZoomLogo} mr="0.5em" />
          <Text fontWeight="normal" ml="1">
            Zoom
          </Text>
        </Flex>
      )
    } else if (type === 'google') {
      return (
        <Flex alignItems="center">
          <Image width={'20px'} src={GoogleMeetLogo} mr="0.5em" />
          <Text fontWeight="normal" ml="1">
            Google Meet
          </Text>
        </Flex>
      )
    }
  }

  return (
    <>
      <Heading size="sm" mt="4">
        Conferencing
      </Heading>

      <Box
        mt="2"
        fontSize="md"
        padding="2"
        borderColor="gray.100"
        borderRadius={'sm'}
        borderWidth="1px"
      >
        {user.zoomConnection ? (
          <ZoomConnected
            user={user}
            zoom={user.zoomConnection}
            addMessage={props.addMessage}
            setUser={props.onUpdateUser}
          />
        ) : (
          <ZoomNotConnected user={user} />
        )}
      </Box>
    </>
  )
}

function ZoomNotConnected(props: { user: User }) {
  return (
    <Flex alignItems="center" justifyContent={'space-between'}>
      <Flex alignItems="center">
        <Box pr="5">
          <Image width={'20px'} src={ZoomLogo} />
        </Box>
        <Text fontSize="sm">Zoom</Text>
      </Flex>

      <Button
        onClick={() => {
          window.open(API.getZoomOauthUrl(props.user.id), '_blank')
        }}
      >
        Connect Zoom
      </Button>
    </Flex>
  )
}

function ZoomConnected(props: {
  user: User
  zoom: ZoomConnection
  addMessage: (message: string) => void
  setUser: (user: User) => void
}) {
  function handleRemoveZoomConnection() {
    const updatedUser = {
      ...props.user,
      zoomConnection: null,
    }
    props.setUser(updatedUser)

    return API.removeZoomConnection().then((res) => {
      props.addMessage(`Zoom account unlinked.`)
    })
  }

  return (
    <Flex alignItems="center" justifyContent={'space-between'}>
      <Flex alignItems="center">
        <Box pr="5">
          <Image width={'20px'} src={ZoomLogo} />
        </Box>
        <Flex direction={'column'}>
          <Text fontSize="sm">Zoom</Text>
          <Text fontSize="xs" color="gray.500">
            {props.zoom.email}
          </Text>
        </Flex>
      </Flex>

      <IconButton
        aria-label="delete"
        icon={<FiTrash />}
        size="xs"
        ml="auto"
        onClick={handleRemoveZoomConnection}
      />
    </Flex>
  )
}
