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
import Calendar, { CalendarEditable, CalendarSource } from '@/models/Calendar'

interface IProps {
  isActive: boolean
  editingCalendar?: Calendar

  onCancel: () => void
  onSave: (fields: CalendarEditable) => void
}

const DEFAULT_CALENDAR_BG_COLOR = '#2196f3'

/**
 * Modal to add / edit a calendar.
 */
export default function CalendarEditModal(props: IProps) {
  const [editableFields, setEditableFields] = React.useState<CalendarEditable>(
    getDefaultEditableFields()
  )

  function getDefaultEditableFields(): CalendarEditable {
    return {
      summary: props.editingCalendar?.summary || '',
      description: props.editingCalendar?.description || '',
      source: 'timecouncil',
      backgroundColor: DEFAULT_CALENDAR_BG_COLOR,
      timezone: undefined,
    }
  }

  React.useEffect(() => {
    setEditableFields(getDefaultEditableFields())
  }, [props.editingCalendar])

  return (
    <Modal isOpen={props.isActive} onClose={props.onCancel}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{props.editingCalendar ? 'Edit Calendar' : 'New Calendar'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="calendar-title" isRequired>
            <FormLabel>Title</FormLabel>
            <Input
              type="text"
              value={editableFields.summary}
              onChange={(e) => {
                setEditableFields({ ...editableFields, summary: e.target.value })
              }}
            />
          </FormControl>

          <FormControl id="calendar-description" mt="2">
            <FormLabel>Description</FormLabel>
            <Input
              className="input"
              type="text"
              placeholder=""
              value={editableFields.description}
              onChange={(e) => {
                setEditableFields({ ...editableFields, description: e.target.value })
              }}
            />
          </FormControl>
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
