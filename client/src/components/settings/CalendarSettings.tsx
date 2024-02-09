import * as React from 'react'
import { FiChevronDown, FiTrash2 } from 'react-icons/fi'
import { useRecoilState, useRecoilValue } from 'recoil'
import { Menu, MenuButton, MenuList, MenuItem, IconButton } from '@chakra-ui/react'
import { Flex, Box, Text, Button, Heading, SimpleGrid, useToast, ToastId } from '@chakra-ui/react'

import { userState } from '@/state/UserState'
import { primaryCalendarSelector } from '@/state/CalendarState'

import Calendar from '@/models/Calendar'
import User from '@/models/User'
import CalendarAccount from '@/models/CalendarAccount'

import CalendarLogo from '@/components/CalendarLogo'
import { InfoAlert } from '@/components/Alert'

import * as API from '@/util/Api'
import SelectCalendar from '@/calendar/event-edit/SelectCalendar'
import SettingsModal from './SettingsModal'

function CalendarSettings() {
  const [user, setUser] = useRecoilState(userState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const [accountToDelete, setAccountToDelete] = React.useState<CalendarAccount | null>(null)

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

  function handleUpdateDefaultCalendar(calendar: Calendar) {
    const updatedUser = { ...user, defaultCalendarId: calendar.id } as User
    setUser(updatedUser)

    API.updateUser(updatedUser).then((res) => {
      addMessage(`Default calendar updated to ${calendar.summary}.`)
    })
  }

  function handleDeleteCalendarAccount(account: CalendarAccount) {
    setAccountToDelete(account)
  }

  function handleConfirmDeleteCalendarAccount(user: User, accountToDelete: CalendarAccount) {
    const updatedUser = {
      ...user,
      accounts: user.accounts.filter((a) => a.id !== accountToDelete.id),
      defaultCalendarId:
        user.defaultCalendarId === accountToDelete.id ? null : user.defaultCalendarId,
    } as User

    return API.removeUserAccount(accountToDelete.id).then((res) => {
      setUser(updatedUser)
      addMessage(`${accountToDelete.email} unlinked.`)
      setAccountToDelete(null)
    })
  }

  return (
    <Flex direction={'column'} width={'100%'}>
      {accountToDelete && (
        <SettingsModal
          onClose={() => {
            setAccountToDelete(null)
          }}
          onConfirm={() => handleConfirmDeleteCalendarAccount(user, accountToDelete)}
          header={`Unlink account ${accountToDelete.email}?`}
          body={`Are you sure you want to unlink this account? This will remove all calendars from this account.`}
          destructive={true}
          confirmText={'Unlink'}
        />
      )}
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
            <CalendarAccountIntegration
              key={account.id}
              account={account}
              onDelete={() => handleDeleteCalendarAccount(account)}
            />
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

function CalendarAccountIntegration(props: { account: CalendarAccount; onDelete: () => void }) {
  return (
    <Box fontSize="md" padding="2" borderRadius={'sm'} bgColor="gray.50">
      <Flex direction={'column'}>
        <Flex alignItems="center">
          <CalendarLogo source={props.account.provider} size={30} />

          <Text fontSize="sm" pl="1">
            Google Calendar
          </Text>

          {!props.account.isDefault && (
            <IconButton
              aria-label="delete"
              icon={<FiTrash2 />}
              size="xs"
              ml="auto"
              onClick={props.onDelete}
            />
          )}
        </Flex>

        <Text fontSize={'sm'} color="gray.500">
          {props.account.email}
        </Text>
      </Flex>
    </Box>
  )
}

export default CalendarSettings
