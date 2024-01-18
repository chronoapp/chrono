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
  Link,
  Text,
} from '@chakra-ui/react'
import { FiExternalLink } from 'react-icons/fi'

import Calendar, { CalendarEditable, CalendarSource } from '@/models/Calendar'

interface IProps {
  isActive: boolean
  editingCalendar?: Calendar

  onCancel: () => void
  onSave: (fields: CalendarEditable) => void
}

const DEFAULT_CALENDAR_BG_COLOR = '#2196f3'
const GOOGLE_CALENDAR_SETTINGS_URL = 'https://calendar.google.com/calendar/u/0/r/settings/calendar/'

/**
 * Modal to add / edit a calendar.
 */
export default function CalendarEditModal(props: IProps) {
  const [editableFields, setEditableFields] = React.useState<CalendarEditable>(
    getDefaultEditableFields()
  )

  function getDefaultEditableFields(): CalendarEditable {
    return {
      summaryOverride:
        props.editingCalendar?.summaryOverride || props.editingCalendar?.summary || '',
      description: props.editingCalendar?.description || '',
      source: props.editingCalendar?.source || 'google',
      backgroundColor: props.editingCalendar?.backgroundColor || DEFAULT_CALENDAR_BG_COLOR,
      timezone: props.editingCalendar?.timezone,
    }
  }

  React.useEffect(() => {
    setEditableFields(getDefaultEditableFields())
  }, [props.editingCalendar])

  return (
    <Modal isOpen={props.isActive} onClose={props.onCancel}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize={'md'}>
          {props.editingCalendar ? 'Edit calendar' : 'New calendar'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="calendar-title">
            <FormLabel fontSize={'sm'}>Title</FormLabel>
            <Input
              type="text"
              size="sm"
              fontSize={'sm'}
              value={editableFields.summaryOverride}
              onChange={(e) => {
                setEditableFields({ ...editableFields, summaryOverride: e.target.value })
              }}
            />
          </FormControl>

          <FormControl id="calendar-description" mt="2">
            <FormLabel fontSize={'sm'}>Description</FormLabel>
            <Input
              type="text"
              size-="sm"
              fontSize={'sm'}
              placeholder=""
              value={editableFields.description}
              onChange={(e) => {
                setEditableFields({ ...editableFields, description: e.target.value })
              }}
            />
          </FormControl>

          {props.editingCalendar && props.editingCalendar.google_id && (
            <Link
              mt="2"
              size="sm"
              href={`${GOOGLE_CALENDAR_SETTINGS_URL}${btoa(props.editingCalendar.google_id)}`}
              display="flex"
              alignItems={'center'}
            >
              <Text mr="1" fontSize={'sm'}>
                More settings
              </Text>
              <FiExternalLink />
            </Link>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant={'ghost'} mr={3} onClick={props.onCancel}>
            Cancel
          </Button>
          <Button colorScheme="primary" onClick={() => props.onSave(editableFields)}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
