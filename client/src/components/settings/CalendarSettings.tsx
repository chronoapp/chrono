import { useRecoilState, useRecoilValue } from 'recoil'

import { userState } from '@/state/UserState'
import { primaryCalendarSelector } from '@/state/CalendarState'

import { Flex, Box, Text, Button, Heading, SimpleGrid, Select } from '@chakra-ui/react'
import CalendarLogo from '@/components/CalendarLogo'
import CalendarAccount from '@/models/CalendarAccount'

import * as API from '@/util/Api'
import SelectCalendar from '@/calendar/event-edit/SelectCalendar'

function CalendarSettings() {
  const [user, setUser] = useRecoilState(userState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

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
          {user?.accounts.map((account) => (
            <CalendarAccountIntegration key={account.id} account={account} />
          ))}
        </SimpleGrid>

        <Box>
          <Text fontSize={'sm'} mt="4">
            Default Calendar
          </Text>

          <SelectCalendar
            accounts={user?.accounts || []}
            selectedCalendarId={primaryCalendar?.id || ''}
            onChange={(calendar) => {}}
          />
        </Box>
      </Box>

      <Heading size="sm" mt="4">
        Conferencing
      </Heading>
      <Box mt="2">
        <Text fontSize={'sm'}>Default Conferencing</Text>
        <Select size="sm" maxW={'sm'}>
          <option value="zoom">Zoom</option>
          <option value="google_meet">Google Meet</option>
        </Select>
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
