import React from 'react'
import produce from 'immer'
import { useRecoilState } from 'recoil'

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
import { useToast, ToastId } from '@chakra-ui/react'
import { InfoAlert } from '@/components/Alert'

import Hoverable from '@/lib/Hoverable'
import groupBy from '@/lib/js-lib/groupBy'
import { normalizeArr } from '@/lib/normalizer'
import { generateGuid } from '@/lib/uuid'

import * as API from '@/util/Api'
import useGlobalEventListener from '@/util/useGlobalEventListener'
import { GlobalEvent } from '@/util/global'

import { calendarsState } from '@/state/CalendarState'
import Calendar, { AccessRole, CalendarSource } from '@/models/Calendar'
import CalendarEditModal from './CalendarEditModal'

import GoogleLogo from '@/assets/google.svg'
import ChronoLogo from '@/assets/chrono.svg'

function renderImageForSource(source: CalendarSource) {
  if (source === 'google') {
    return <img src={GoogleLogo} width={22} />
  } else {
    return <img src={ChronoLogo} width={22} height="100%" />
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
          <AlertDialogHeader fontSize="md">Remove calendar from list?</AlertDialogHeader>
          <AlertDialogBody fontSize={'sm'}>
            To add the calendar back to your list, you will need to re-add it from google calendar
            settings.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={props.cancelRef} onClick={props.onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={() => props.onDelete(props.calendarId!)} ml={3}>
              Remove calendar
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
export default function CalendarList() {
  const toast = useToast()
  const toastIdRef = React.useRef<ToastId>()

  const [calendars, setCalendars] = useRecoilState(calendarsState)

  const confirmDeleteCancelRef = React.useRef<HTMLButtonElement>(null)
  const [confirmDeleteCalendarId, setConfirmDeleteCalendarId] = React.useState<undefined | string>(
    undefined
  )

  const [editModalActive, setEditModalActive] = React.useState(false)
  const [editingCalendarId, setEditingCalendarId] = React.useState<undefined | string>(undefined)

  // Refresh the calendar when we receive a refresh event.
  const [refreshId, setRefreshId] = React.useState(generateGuid())

  const handleRefreshEvent = React.useCallback(() => {
    setRefreshId(generateGuid())
  }, [])

  useGlobalEventListener(GlobalEvent.refreshCalendarList, handleRefreshEvent)

  React.useEffect(() => {
    async function init() {
      const calendars = await API.getCalendars()
      initCalendars(calendars)
    }
    init()
  }, [refreshId])

  const initCalendars = (calendars: Calendar[]) => {
    setCalendars({ loading: false, calendarsById: normalizeArr(calendars, 'id') })
  }

  const updateCalendar = (calendar: Calendar) => {
    setCalendars((prevState) => {
      return {
        ...prevState,
        calendarsById: produce(prevState.calendarsById, (draftCalendarsById) => {
          draftCalendarsById[calendar.id] = calendar
        }),
      }
    })
  }

  const deleteCalendar = (calendarId: string) => {
    setCalendars((prevState) => {
      const newCalendars = { ...prevState.calendarsById }
      delete newCalendars[calendarId]
      return { ...prevState, calendarsById: newCalendars }
    })
  }

  function onSelectCalendar(calendar: Calendar, selected: boolean) {
    const updated = produce(calendar, (draft) => {
      draft.selected = selected
    })
    updateCalendar(updated)

    API.putCalendar(updated)
  }

  async function onDeleteCalendar(calendarId: string) {
    const calendarName = calendars.calendarsById[calendarId].summary
    setConfirmDeleteCalendarId(undefined)
    deleteCalendar(calendarId)

    API.deleteCalendar(calendarId).then(() => {
      toastIdRef.current && toast.close(toastIdRef.current)
      toastIdRef.current = toast({
        render: (props) => <InfoAlert title={`Removed calendar ${calendarName}.`} />,
      })
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
                    style={{
                      backgroundColor: selected ? calendar.backgroundColor : '#eee',
                    }}
                  ></span>
                </label>

                <Flex align="center" justifyContent="space-between" w="100%" whiteSpace={'nowrap'}>
                  <Text
                    userSelect="none"
                    fontSize="sm"
                    color={'gray.700'}
                    pl="2"
                    overflow={'hidden'}
                  >
                    {calendar.summary}
                  </Text>

                  {isMouseInside && (
                    <Menu isLazy gutter={-1}>
                      <MenuButton
                        height="100%"
                        variant="unstyled"
                        color="gray.600"
                        size="xs"
                        as={Button}
                      >
                        <FiMoreHorizontal size={'1.25em'} />
                      </MenuButton>

                      <Portal>
                        <MenuList>
                          <MenuItem
                            fontSize={'sm'}
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
                            fontSize={'sm'}
                            onClick={() => {
                              setConfirmDeleteCalendarId(calendar.id)
                              onMouseLeave()
                            }}
                            icon={<FiTrash />}
                            iconSpacing="1"
                          >
                            Remove from list
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

  function addErrorMessage(title: string, details: string = '') {
    toastIdRef.current && toast.close(toastIdRef.current)

    toastIdRef.current = toast({
      title: title,
      duration: 3000,
      render: (p) => {
        return <InfoAlert onClose={p.onClose} title={title} icon={'info'} details={details} />
      },
    })
  }

  const groupedCalendars = groupBy(Object.values(calendars.calendarsById), (cal) => cal.source)
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
          editingCalendarId !== undefined ? calendars.calendarsById[editingCalendarId] : undefined
        }
        onCancel={() => setEditModalActive(false)}
        onSave={async (fields) => {
          if (!fields.summary) {
            addErrorMessage("Title can't be empty", 'Please enter a title before submitting.')
            return
          }

          if (editingCalendarId) {
            const updatedCalendar = {
              ...calendars.calendarsById[editingCalendarId],
              ...fields,
            } as Calendar

            const calendar = await API.putCalendar(updatedCalendar)
            updateCalendar(calendar)
          } else {
            const calendar = await API.createCalendar(
              fields.summary,
              fields.backgroundColor,
              fields.source,
              fields.description,
              fields.timezone
            )
            updateCalendar(calendar)
          }

          setEditModalActive(false)
        }}
      />

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
                <AccordionButton height="8" p="1" display="flex" justifyContent="space-between">
                  <Flex alignItems="center">
                    {renderImageForSource(calendarSource)}
                    <Text fontSize="sm" pl="2" color="gray.800" fontWeight="md">
                      {groupName}
                    </Text>
                  </Flex>
                  <AccordionIcon color="gray.600" />
                </AccordionButton>

                <AccordionPanel pt="0" pb="0" pr="0">
                  {renderCalendarList(calendars)}

                  <Button
                    fontSize={'xs'}
                    color="gray.600"
                    fontWeight="normal"
                    variant="link"
                    onClick={() => {
                      setEditingCalendarId(undefined)
                      setEditModalActive(true)
                    }}
                    float="left"
                    m="2"
                  >
                    <FiPlus /> add calendar
                  </Button>
                </AccordionPanel>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </>
  )
}
