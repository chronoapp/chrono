import { FiChevronDown } from 'react-icons/fi'

import { FiTrash } from 'react-icons/fi'
import { Menu, MenuButton, MenuList, MenuItem, Image, IconButton } from '@chakra-ui/react'
import { Flex, Box, Text, Button, Heading } from '@chakra-ui/react'
import ZoomLogo from '@/assets/zoom-app.svg'

import User from '@/models/User'
import * as API from '@/util/Api'
import ZoomConnection from '@/models/ZoomConnection'

export default function ConferencingSettings(props: {
  user: User
  addMessage: (message: string) => void
  onUpdateUser: (user: User) => void
}) {
  const { user } = props

  function renderConferenceType(conferenceType: string) {
    return (
      <Flex alignItems="center">
        <Text fontWeight="normal" ml="1">
          Zoom
        </Text>
      </Flex>
    )
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

      <Box mt="4">
        <Text fontSize={'sm'}>Default Conferencing</Text>
        <Menu>
          <MenuButton
            as={Button}
            size="sm"
            borderRadius="sm"
            variant="ghost"
            rightIcon={<FiChevronDown />}
          >
            {renderConferenceType('zoom')}
          </MenuButton>

          <MenuList mt="-1" p="0" fontSize={'xs'}>
            <MenuItem value="zoom">Zoom</MenuItem>
            <MenuItem value="google_meet">Google Meet</MenuItem>
          </MenuList>
        </Menu>
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
