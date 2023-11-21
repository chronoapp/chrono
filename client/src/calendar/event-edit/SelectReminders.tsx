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

function formatReminder(minutes) {
  if (minutes < 60) {
    return minutes + ' min' + (minutes !== 1 ? 's' : '')
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    let result = hours + ' hour' + (hours !== 1 ? 's' : '')
    if (remainingMinutes > 0) {
      result += ' ' + remainingMinutes + ' min' + (remainingMinutes !== 1 ? 's' : '')
    }
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      result = days + ' day' + (days !== 1 ? 's' : '')
      if (remainingHours > 0) {
        result += ' ' + remainingHours + ' hour' + (remainingHours !== 1 ? 's' : '')
      }
    }
    return result
  }
}

interface IProps {
  useDefaultReminders: boolean
  defaultReminders: ReminderOverride[]

  reminders: ReminderOverride[]
  onUpdateReminders?: (reminders: ReminderOverride[]) => void

  readonly: boolean
}

const DEFAULT_REMINDER_OPTIONS = [
  new ReminderOverride('popup', 0),
  new ReminderOverride('popup', 5),
  new ReminderOverride('popup', 10),
  new ReminderOverride('popup', 30),
]

function reminderText(reminder: ReminderOverride, readonly: boolean) {
  const { minutes } = reminder

  if (minutes === 0) {
    return <Text fontSize={'sm'}>At start of event</Text>
  } else {
    return (
      <Flex fontSize={'sm'}>
        <Text fontWeight={readonly ? 'normal' : 'medium'}>{formatReminder(minutes)}</Text>
        <Text ml="1">before</Text>
      </Flex>
    )
  }
}

export default function SelectReminders(props: IProps) {
  const { reminders, useDefaultReminders, defaultReminders, readonly, onUpdateReminders } = props
  const remindersList = useDefaultReminders ? defaultReminders : reminders
  const sortedReminders = [...remindersList].sort((a, b) => a.minutes - b.minutes)

  if (!readonly && !onUpdateReminders) {
    throw new Error('onUpdateReminders is required when readonly is false')
  }

  return (
    <Flex direction={'column'}>
      {!readonly && (
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
                  if (onUpdateReminders && !existingReminder) {
                    onUpdateReminders([...sortedReminders, reminder])
                  }
                }}
              >
                <span>{reminderText(reminder, readonly)}</span>
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      )}

      <Flex direction={'column'}>
        {sortedReminders.map((reminder, idx) => (
          <Reminder
            key={idx}
            reminder={reminder}
            onSelect={(r) => {
              const newReminders = [...sortedReminders]
              newReminders.splice(idx, 1)
              onUpdateReminders && onUpdateReminders(newReminders)
            }}
            readonly={readonly}
          />
        ))}
      </Flex>
    </Flex>
  )
}

function Reminder(props: {
  reminder: ReminderOverride
  onSelect: (reminders: ReminderOverride) => void
  readonly: boolean
}) {
  const { reminder, readonly } = props

  return (
    <Hoverable>
      {(isMouseInside, onMouseEnter, onMouseLeave) => (
        <Flex
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          fontSize="sm"
          alignItems="center"
          pt={readonly ? '0' : '1'}
          pb={readonly ? '0' : '1'}
          pl={readonly ? '0' : '2'}
          bgColor={!readonly && isMouseInside && 'gray.100'}
          borderRadius="md"
        >
          <Box width="32">{reminderText(reminder, readonly)}</Box>

          {!readonly && isMouseInside && (
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
