import React from 'react'
import { Button, Box, Flex, Text, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import Calendar from '../../models/Calendar'

interface IProps {
  calendarsById: Record<number, Calendar>
  defaultCalendarId: string
  onChange: (calendarId: string) => void
}

export default function SelectCalendar(props: IProps) {
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

  const calendars = Object.values(props.calendarsById).filter((cal) => cal.isWritable())
  const selectedCal = props.calendarsById[props.defaultCalendarId]

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
        {calendars.map((calendar, idx) => (
          <MenuItem key={idx} fontSize="sm" onClick={() => props.onChange(calendar.id)}>
            {renderCalendarItem(calendar)}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  )
}
