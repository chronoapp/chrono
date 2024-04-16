import { ZonedDateTime as DateTime } from '@js-joda/core'

import { Button, Text, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

interface IProps {
  days: number
  startDate: DateTime
  onSelectNumDays: (days: number) => void
}

const MAX_DAYS = 5

function TimeSelectFullDay(props: IProps) {
  const options: { value: number; label: string }[] = []
  const dayText = (days: number) => `${days} day${days > 1 ? 's' : ''}`

  for (let i = 1; i < MAX_DAYS + 1; i++) {
    options.push({ value: i, label: dayText(i) })
  }

  return (
    <Menu>
      <MenuButton
        size="sm"
        as={Button}
        fontWeight="normal"
        variant="ghost"
        rightIcon={<FiChevronDown />}
      >
        <Text>{dayText(props.days)}</Text>
      </MenuButton>
      <MenuList mt="-1" p="0">
        {options.map((option, idx) => (
          <MenuItem key={idx} fontSize="sm" onClick={() => props.onSelectNumDays(option.value)}>
            {option.label}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  )
}

export default TimeSelectFullDay
