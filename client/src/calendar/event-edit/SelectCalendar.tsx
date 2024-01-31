import { useRecoilValue } from 'recoil'

import {
  Button,
  Box,
  Flex,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
} from '@chakra-ui/react'

import { FiChevronDown } from 'react-icons/fi'
import groupBy from '@/lib/js-lib/groupBy'

import Calendar from '@/models/Calendar'
import CalendarAccount from '@/models/CalendarAccount'

import { userState } from '@/state/UserState'

interface IProps {
  calendarsById: Record<number, Calendar>
  originalCalendarId: string | null
  selectedCalendarId: string
  onChange: (calendar: Calendar) => void
}

export default function SelectCalendar(props: IProps) {
  const user = useRecoilValue(userState)

  const writableCalendars = Object.values(props.calendarsById).filter((cal) => cal.isWritable())
  const selectedCal = props.calendarsById[props.selectedCalendarId]

  // Since moving events between accounts isn't supported yet,
  // we only show calendars from the same account as the original calendar.
  let accounts: CalendarAccount[] = user?.accounts || []
  if (props.originalCalendarId) {
    const originalCalendar = props.calendarsById[props.originalCalendarId]
    accounts = accounts.filter((account) => account.id === originalCalendar.account_id) || []
  }

  const groupedCalendars = groupBy(writableCalendars, (cal) => cal.account_id)

  function renderCalendarItem(calendar: Calendar) {
    return (
      <Flex alignItems="center">
        <Box borderRadius="md" w="4" h="4" bg={calendar.backgroundColor} />
        <Text fontWeight="normal" ml="1">
          {calendar.summary}
        </Text>
      </Flex>
    )
  }

  return (
    <Menu>
      <MenuButton
        size="sm"
        borderRadius="sm"
        as={Button}
        variant="ghost"
        rightIcon={<FiChevronDown />}
      >
        {renderCalendarItem(selectedCal)}
      </MenuButton>

      <MenuList mt="-1" p="0" zIndex="10">
        {accounts.map((account) => {
          const calendars = groupedCalendars.get(account.id)!

          return (
            <MenuGroup
              key={account.id}
              title={account.email}
              fontSize={'xs'}
              color="gray.600"
              fontWeight={'medium'}
            >
              {calendars.map((calendar, idx) => (
                <MenuItem key={idx} fontSize="sm" onClick={() => props.onChange(calendar)}>
                  {renderCalendarItem(calendar)}
                </MenuItem>
              ))}
            </MenuGroup>
          )
        })}
      </MenuList>
    </Menu>
  )
}
