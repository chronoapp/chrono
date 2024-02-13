import { FiChevronDown } from 'react-icons/fi'

import { Menu, MenuButton, MenuList, MenuItem, Image } from '@chakra-ui/react'
import { Flex, Box, Text, Button, Heading } from '@chakra-ui/react'
import ZoomLogo from '@/assets/zoom-app.svg'

import User from '@/models/User'
import * as API from '@/util/Api'

export default function ConferencingSettings(props: { user: User }) {
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
        <Flex alignItems="center" justifyContent={'space-between'}>
          <Flex alignItems="center">
            <Box pr="5">
              <Image width={'20px'} src={ZoomLogo} />
            </Box>
            <Text fontSize="sm">Zoom</Text>
          </Flex>

          <Button
            onClick={() => {
              window.open(API.getZoomOauthUrl(user.id), '_blank')
            }}
          >
            Connect Zoom
          </Button>
        </Flex>
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
