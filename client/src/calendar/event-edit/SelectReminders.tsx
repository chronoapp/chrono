import { FiChevronDown, FiX } from 'react-icons/fi'
import {
  Flex,
  Box,
  Menu,
  Button,
  IconButton,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
} from '@chakra-ui/react'

import Hoverable from '@/lib/Hoverable'
import ReminderOverride from '@/models/ReminderOverride'

interface IProps {
  useDefaultReminders: boolean
  defaultReminders: ReminderOverride[]

  reminders: ReminderOverride[]
  onUpdateReminders: (reminders: ReminderOverride[]) => void
}

const DEFAULT_REMINDER_OPTIONS = [
  new ReminderOverride('popup', 0),
  new ReminderOverride('popup', 5),
  new ReminderOverride('popup', 10),
  new ReminderOverride('popup', 30),
]

function reminderText(reminder: ReminderOverride) {
  const { minutes } = reminder
  if (minutes === 0) {
    return <Text fontSize={'sm'}>At start of event</Text>
  } else {
    return (
      <Flex fontSize={'sm'}>
        <Text fontWeight={'medium'}>{minutes} mins</Text>
        <Text ml="1">before</Text>
      </Flex>
    )
  }
}

export default function SelectReminders(props: IProps) {
  const { reminders, useDefaultReminders, defaultReminders } = props
  const remindersList = useDefaultReminders ? defaultReminders : reminders
  const sortedReminders = [...remindersList].sort((a, b) => a.minutes - b.minutes)

  return (
    <Flex direction={'column'}>
      <Menu>
        <MenuButton
          as={Button}
          variant="ghost"
          rightIcon={<FiChevronDown />}
          fontWeight={'normal'}
          width={'fit-content'}
        >
          Add reminder
        </MenuButton>

        <MenuList>
          {DEFAULT_REMINDER_OPTIONS.map((reminder, idx) => (
            <MenuItem
              fontSize="sm"
              key={idx}
              onClick={() => {
                const existingReminder = sortedReminders.find(
                  (r) => r.method === reminder.method && r.minutes === reminder.minutes
                )
                if (!existingReminder) {
                  props.onUpdateReminders([...sortedReminders, reminder])
                }
              }}
            >
              <span>{reminderText(reminder)}</span>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>

      <Flex direction={'column'}>
        {sortedReminders.map((reminder, idx) => (
          <Reminder
            key={idx}
            reminder={reminder}
            onSelect={(r) => {
              const newReminders = [...sortedReminders]
              newReminders.splice(idx, 1)
              props.onUpdateReminders(newReminders)
            }}
          />
        ))}
      </Flex>
    </Flex>
  )
}

function Reminder(props: {
  reminder: ReminderOverride
  onSelect: (reminders: ReminderOverride) => void
}) {
  const { reminder } = props

  return (
    <Hoverable>
      {(isMouseInside, onMouseEnter, onMouseLeave) => (
        <Flex
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          fontSize="sm"
          alignItems="center"
          mt="1"
          p="1"
          pl="2"
          pr="0"
          bgColor={isMouseInside && 'gray.100'}
          borderRadius="md"
        >
          <Box width="32">{reminderText(reminder)}</Box>

          {isMouseInside && (
            <IconButton
              alignSelf={'right'}
              variant="link"
              aria-label="remove reminder"
              icon={<FiX />}
              size="sm"
              onClick={() => {
                props.onSelect(reminder)
              }}
            ></IconButton>
          )}
        </Flex>
      )}
    </Hoverable>
  )
}
