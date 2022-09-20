import React from 'react'
import { FiPlus, FiMoreHorizontal, FiTrash, FiEdit } from 'react-icons/fi'
import {
  Text,
  Flex,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Portal,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react'
import Hoverable from '@/lib/Hoverable'
import groupBy from '@/lib/js-lib/groupBy'

import { CalendarsContext, CalendarsContextType } from '@/contexts/CalendarsContext'
import * as API from '@/util/Api'
import Calendar, { AccessRole, CalendarSource } from '@/models/Calendar'
import CalendarEditModal from './CalendarEditModal'

import produce from 'immer'

function renderImageForSource(source: CalendarSource) {
  if (source === 'google') {
    return <img src={'./google.svg'} width={22} />
  } else {
    return <img src={'./chrono.svg'} width={22} height="100%" />
  }
}

/**
 * TODO: Show number of events in the calendar.
 */
function ConfirmDeleteCalendarAlert(props: {
  calendarId: string | undefined
  onClose: () => void
  onDelete: (calendarId: string) => void
  cancelRef: React.RefObject<HTMLButtonElement>
}) {
  const isOpen = props.calendarId !== undefined
  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={props.cancelRef} onClose={props.onClose}>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Delete Calendar
          </AlertDialogHeader>

          <AlertDialogBody>Are you sure? You can't undo this action afterwards.</AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={props.cancelRef} onClick={props.onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={() => props.onDelete(props.calendarId!)} ml={3}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

/**
 * Displays list of calendars.
 * TODO: Use calendar color, not event color.
 * TODO: Update selected calendars to server.
 */
export default function CalendarsPanel() {
  const { calendarsById, loadCalendars, updateCalendarSelect, setCalendar, deleteCalendar } =
    React.useContext<CalendarsContextType>(CalendarsContext)

  const confirmDeleteCancelRef = React.useRef<HTMLButtonElement>(null)
  const [confirmDeleteCalendarId, setConfirmDeleteCalendarId] = React.useState<undefined | string>(
    undefined
  )

  const [editModalActive, setEditModalActive] = React.useState(false)
  const [editingCalendarId, setEditingCalendarId] = React.useState<undefined | string>(undefined)

  React.useEffect(() => {
    async function init() {
      const authToken = API.getAuthToken()
      const calendars = await API.getCalendars(authToken)
      loadCalendars(calendars)
    }
    init()
  }, [])

  function onSelectCalendar(calendar: Calendar, selected: boolean) {
    updateCalendarSelect(calendar.id, selected)

    const updated = produce(calendar, (draft) => {
      draft.selected = selected
    })

    API.putCalendar(updated, API.getAuthToken())
  }

  async function onDeleteCalendar(calendarId: string) {
    setConfirmDeleteCalendarId(undefined)
    deleteCalendar(calendarId)

    // TODO: Show loading
    API.deleteCalendar(calendarId, API.getAuthToken()).then(() => {
      console.log(`Deleted: ${calendarId}`)
    })
  }

  function accessRolePrecedence(accessRole: AccessRole) {
    if (accessRole === 'owner') {
      return 0
    } else if (accessRole == 'writer') {
      return 1
    } else if (accessRole == 'reader') {
      return 2
    } else {
      return 3
    }
  }

  function renderCalendarList(calendars: Calendar[]) {
    const sortedCalendars = calendars.sort((a, b) => {
      if (a.primary && !b.primary) {
        return -5
      } else {
        return accessRolePrecedence(a.accessRole) - accessRolePrecedence(b.accessRole)
      }
    })

    return (
      sortedCalendars.length > 0 &&
      sortedCalendars.map((calendar, idx) => {
        const selected = calendar.selected || false
        return (
          <Hoverable key={idx}>
            {(isMouseInside, onMouseEnter, onMouseLeave) => (
              <Flex onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} pl="2" pt="1" pb="1">
                <label className="cal-checkbox-container tag-block">
                  <input
                    type="checkbox"
                    checked={selected}
                    className="cal-checkbox"
                    onChange={(v) => {
                      onSelectCalendar(calendar, v.target.checked)
                    }}
                  />
                  <span
                    className="cal-checkmark"
                    style={{ backgroundColor: selected ? calendar.backgroundColor : '#eee' }}
                  ></span>
                </label>

                <Flex align="center" justifyContent="space-between" w="100%">
                  <Text fontSize="sm" pl="2">
                    {calendar.summary}
                  </Text>

                  {isMouseInside && (
                    <Menu isLazy>
                      <MenuButton
                        height="100%"
                        variant="unstyled"
                        color="gray.600"
                        size="xs"
                        as={Button}
                        fontWeight="normal"
                      >
                        <FiMoreHorizontal size={'1.25em'} />
                      </MenuButton>

                      <Portal>
                        <MenuList>
                          <MenuItem
                            onClick={() => {
                              setEditModalActive(true)
                              setEditingCalendarId(calendar.id)
                              onMouseLeave()
                            }}
                            icon={<FiEdit />}
                            iconSpacing="1"
                          >
                            Edit
                          </MenuItem>
                          <MenuItem
                            onClick={() => {
                              setConfirmDeleteCalendarId(calendar.id)
                              onMouseLeave()
                            }}
                            icon={<FiTrash />}
                            iconSpacing="1"
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Portal>
                    </Menu>
                  )}
                </Flex>
              </Flex>
            )}
          </Hoverable>
        )
      })
    )
  }

  const groupedCalendars = groupBy(Object.values(calendarsById), (cal) => cal.source)
  const keyArr = Array.from(groupedCalendars.keys())

  return (
    <>
      <ConfirmDeleteCalendarAlert
        calendarId={confirmDeleteCalendarId}
        onClose={() => setConfirmDeleteCalendarId(undefined)}
        onDelete={(calendarId) => onDeleteCalendar(calendarId)}
        cancelRef={confirmDeleteCancelRef}
      />

      <CalendarEditModal
        isActive={editModalActive}
        editingCalendar={
          editingCalendarId !== undefined ? calendarsById[editingCalendarId] : undefined
        }
        onCancel={() => setEditModalActive(false)}
        onSave={async (fields) => {
          // TODO: Handle errors, add alerts

          if (editingCalendarId) {
            const updatedCalendar = { ...calendarsById[editingCalendarId], ...fields }
            const calendar = await API.putCalendar(updatedCalendar, API.getAuthToken())
            setCalendar(calendar)
          } else {
            const calendar = await API.createCalendar(
              API.getAuthToken(),
              fields.summary,
              fields.backgroundColor,
              fields.source,
              fields.description,
              fields.timezone
            )
            setCalendar(calendar)
          }

          setEditModalActive(false)
        }}
      />

      <Text align="left" fontWeight="medium" mt="3">
        Calendars
      </Text>

      {keyArr.length > 0 && (
        <Accordion defaultIndex={keyArr.map((c, idx) => idx)} allowMultiple={true}>
          {keyArr.map((calendarSource) => {
            const calendars = groupedCalendars.get(calendarSource)
            if (!calendars) {
              return
            }

            const groupName = calendarSource == 'google' ? 'Google' : 'Chrono'

            return (
              <AccordionItem key={calendarSource} border="0" mt="1">
                <AccordionButton
                  height="8"
                  pt="2"
                  pb="2"
                  pl="1"
                  display="flex"
                  justifyContent="space-between"
                >
                  <Flex alignItems="center">
                    {renderImageForSource(calendarSource)}
                    <Text fontSize="sm" pl="1">
                      {groupName}
                    </Text>
                  </Flex>
                  <AccordionIcon />
                </AccordionButton>

                <AccordionPanel pt="0" pb="0" pr="0">
                  {renderCalendarList(calendars)}
                </AccordionPanel>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}

      <Button
        color="gray.600"
        fontWeight="normal"
        variant="link"
        onClick={() => setEditModalActive(true)}
        justifyContent="left"
        m="2"
      >
        <FiPlus /> add calendar
      </Button>
    </>
  )
}
