import * as React from 'react'

import { FiTrash2 } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import { Flex, Box, Text, Button, Heading, SimpleGrid, IconButton } from '@chakra-ui/react'

import { primaryCalendarSelector } from '@/state/CalendarState'
import Calendar from '@/models/Calendar'
import User from '@/models/User'
import CalendarAccount from '@/models/CalendarAccount'

import CalendarLogo from '@/components/CalendarLogo'
import * as API from '@/util/Api'
import SelectCalendar from '@/calendar/event-edit/SelectCalendar'
import SettingsModal from './SettingsModal'

export default function CalendarSettings(props: {
  user: User
  addMessage: (message: string) => void
  onUpdateUser: (user: User) => void
}) {
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const [accountToDelete, setAccountToDelete] = React.useState<CalendarAccount | null>(null)
  const { user } = props

  function handleUpdateDefaultCalendar(calendar: Calendar) {
    const updatedUser = { ...user, defaultCalendarId: calendar.id } as User

    API.updateUser(updatedUser).then((res) => {
      props.addMessage(`Default calendar updated to ${calendar.summary}.`)
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
      props.onUpdateUser(updatedUser)
      props.addMessage(`${accountToDelete.email} unlinked.`)
      setAccountToDelete(null)
    })
  }

  return (
    <>
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

        <Box mt="4">
          <Text fontSize={'sm'}>Default Calendar</Text>

          <SelectCalendar
            accounts={props.user.accounts}
            selectedCalendarId={primaryCalendar?.id || ''}
            onChange={handleUpdateDefaultCalendar}
          />
        </Box>
      </Box>
    </>
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
