import React from 'react'
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react'

interface IProps {
  isActive: boolean
  onCancel: () => void
  onSave: (
    name: string,
    description: string,
    timezone: string,
    backgroundColor: string,
    isGoogleCalendar: boolean
  ) => void
}

const DEFAULT_CALENDAR_BG_COLOR = '#2196f3'

/**
 * Modal to add / edit a calendar.
 */
export default function CalendarEditModal(props: IProps) {
  const [calendarName, setCalendarName] = React.useState<string>('')
  const [description, setDescription] = React.useState<string>('')
  const [timezone, setTimezone] = React.useState<string>(null!)
  const [isGoogleCalendar, setIsGoogleCalendar] = React.useState<boolean>(false)
  const [backgroundColor, setBackgroundColor] = React.useState<string>(DEFAULT_CALENDAR_BG_COLOR)

  return (
    <Modal isOpen={props.isActive} onClose={props.onCancel}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New Calendar</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="calendar-title" isRequired>
            <FormLabel>Title</FormLabel>
            <Input
              type="text"
              placeholder=""
              value={calendarName}
              onChange={(e) => {
                setCalendarName(e.target.value)
              }}
            />
          </FormControl>

          <FormControl id="calendar-description" mt="2">
            <FormLabel>Description</FormLabel>
            <Input
              className="input"
              type="text"
              placeholder=""
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
              }}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button variant={'ghost'} mr={3} onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            colorScheme="primary"
            onClick={() =>
              props.onSave(calendarName, description, timezone, backgroundColor, isGoogleCalendar)
            }
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
