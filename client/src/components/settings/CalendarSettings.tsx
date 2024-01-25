import { useRecoilState } from 'recoil'
import { userState } from '@/state/UserState'
import { Flex, Box, Text, Button, Heading, SimpleGrid, Select } from '@chakra-ui/react'
import GoogleLogo from '@/assets/google.svg'

function CalendarSettings() {
  const [user, setUser] = useRecoilState(userState)

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
              <img src={GoogleLogo} style={{ width: '30px', paddingRight: 5 }}></img>{' '}
              <Text fontSize="sm">Add Google Calendar Account</Text>
            </Flex>
            <Button>Sign in With Google</Button>
          </Flex>
        </Box>

        <SimpleGrid columns={2} spacing={10} mt="2">
          <Box fontSize="md" padding="2" borderRadius={'sm'} bgColor="gray.50">
            <Flex direction={'column'}>
              <Flex alignItems="center">
                <img src={GoogleLogo} style={{ width: '30px', paddingRight: 5 }}></img>{' '}
                <Text fontSize="sm">Google Calendar</Text>
              </Flex>

              <Text fontSize={'sm'} color="gray.500">
                {user?.email}
              </Text>
            </Flex>
          </Box>
        </SimpleGrid>
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

export default CalendarSettings
