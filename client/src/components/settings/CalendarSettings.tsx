import * as React from 'react'
import { FiChevronDown } from 'react-icons/fi'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'
import { Flex, Box, Text, Button, Heading, SimpleGrid, useToast, ToastId } from '@chakra-ui/react'

import { userState } from '@/state/UserState'
import { primaryCalendarSelector } from '@/state/CalendarState'
import Calendar from '@/models/Calendar'

import CalendarLogo from '@/components/CalendarLogo'
import CalendarAccount from '@/models/CalendarAccount'
import { InfoAlert } from '@/components/Alert'

import * as API from '@/util/Api'
import SelectCalendar from '@/calendar/event-edit/SelectCalendar'

function CalendarSettings() {
  const [user, setUser] = useRecoilState(userState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const toastIdRef = React.useRef<ToastId>()
  const toast = useToast()

  if (!user) {
    return null
  }

  function renderConferenceType(conferenceType: string) {
    return (
      <Flex alignItems="center">
        <Text fontWeight="normal" ml="1">
          Zoom
        </Text>
      </Flex>
    )
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

  const handleUpdateDefaultCalendar = (calendar: Calendar) => {
    const updatedUser = { ...user, defaultCalendarId: calendar.id }
    setUser(updatedUser)

    API.updateUser(updatedUser).then((res) => {
      addMessage(`Default calendar updated to ${calendar.summary}.`)
    })
  }

  return (
    <Flex direction={'column'} width={'100%'}>
      <Heading size="sm">General</Heading>
      <Box mt="2">
        <Text fontSize={'sm'}>Timezone</Text>
      </Box>

      <Heading size="sm" mt="4">
        Calendars
      </Heading>

      <Box mt="2">
        <Box fontSize="md" padding="2" borderColor="gray.100" borderRadius={'sm'} borderWidth="1px">
          <Flex alignItems="center" justifyContent={'space-between'}>
            <Flex alignItems="center">
              <Box pr="5">
                <CalendarLogo source={'google'} size={30} />
              </Box>
              <Text fontSize="sm">Add Google Calendar Account</Text>
            </Flex>
            <Button
              onClick={() => {
                window.open(API.getGoogleOauthUrl('add_account', user!.id), '_blank')
              }}
            >
              Sign in With Google
            </Button>
          </Flex>
        </Box>

        <SimpleGrid columns={2} spacing={2} mt="2">
          {user.accounts.map((account) => (
            <CalendarAccountIntegration key={account.id} account={account} />
          ))}
        </SimpleGrid>

        <Box>
          <Text fontSize={'sm'} mt="4">
            Default Calendar
          </Text>

          <SelectCalendar
            accounts={user.accounts}
            selectedCalendarId={primaryCalendar?.id || ''}
            onChange={handleUpdateDefaultCalendar}
          />
        </Box>
      </Box>

      <Heading size="sm" mt="4">
        Conferencing
      </Heading>

      <Box mt="2">
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
    </Flex>
  )
}

function CalendarAccountIntegration(props: { account: CalendarAccount }) {
  return (
    <Box fontSize="md" padding="2" borderRadius={'sm'} bgColor="gray.50">
      <Flex direction={'column'}>
        <Flex alignItems="center">
          <CalendarLogo source={props.account.provider} size={30} />
          <Text fontSize="sm" pl="1">
            Google Calendar
          </Text>
        </Flex>

        <Text fontSize={'sm'} color="gray.500">
          {props.account.email}
        </Text>
      </Flex>
    </Box>
  )
}

export default CalendarSettings
