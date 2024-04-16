import React from 'react'
import produce from 'immer'
import { useRecoilState, useRecoilValue } from 'recoil'

import { FiPlus } from 'react-icons/fi'
import {
  Text,
  Flex,
  Button,
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

import groupBy from '@/lib/js-lib/groupBy'
import { normalizeArr } from '@/lib/normalizer'
import { generateGuid } from '@/lib/uuid'

import * as API from '@/util/Api'
import useGlobalEventListener from '@/util/useGlobalEventListener'
import { GlobalEvent } from '@/util/global'

import { calendarsState } from '@/state/CalendarState'
import { userState } from '@/state/UserState'
import Calendar from '@/models/Calendar'
import CalendarEditModal from './CalendarEditModal'
import CalendarLogo from './CalendarLogo'
import CalendarList from './CalendarList'

interface EditingCalendar {
  accountId: string
  calendarId: string | null
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
 *
 */
export default function CalendarAccountList() {
  const toast = useToast()
  const toastIdRef = React.useRef<ToastId>()

  const user = useRecoilValue(userState)
  const [calendars, setCalendars] = useRecoilState(calendarsState)

  const confirmDeleteCancelRef = React.useRef<HTMLButtonElement>(null)
  const [confirmDeleteCalendarId, setConfirmDeleteCalendarId] = React.useState<undefined | string>(
    undefined
  )

  const [editingCalendar, setEditingCalendar] = React.useState<EditingCalendar | undefined>(
    undefined
  )
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

    if (user?.accounts) {
      init()
    }
  }, [refreshId, user?.accounts])

  const initCalendars = (calendars: Calendar[]) => {
    const calendarsbyId = normalizeArr(calendars, 'id')
    setCalendars({ loading: false, calendarsById: calendarsbyId })
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

  function renderEditingCalendarModal() {
    if (!editingCalendar) {
      return
    }

    const calendar = editingCalendar.calendarId
      ? calendars.calendarsById[editingCalendar.calendarId]
      : undefined

    const account = user?.accounts?.find((acc) => acc.id === editingCalendar.accountId)
    if (!account) {
      throw new Error('Account not found')
    }

    return (
      <CalendarEditModal
        editingCalendar={calendar}
        account={account}
        onCancel={() => setEditingCalendar(undefined)}
        onSave={async (account, fields) => {
          if (!fields.summary) {
            addErrorMessage("Title can't be empty", 'Please enter a title before submitting.')
            return
          }

          if (editingCalendar.calendarId) {
            const updatedCalendar = {
              ...calendars.calendarsById[editingCalendar.calendarId],
              ...fields,
            } as Calendar

            const calendar = await API.putCalendar(updatedCalendar)
            updateCalendar(calendar)
          } else {
            const calendar = await API.createCalendar(
              account.id,
              fields.summary,
              fields.foregroundColor,
              fields.backgroundColor,
              fields.source,
              fields.description,
              fields.timezone
            )
            updateCalendar(calendar)
          }

          setEditingCalendar(undefined)
        }}
      />
    )
  }

  function renderAccountList() {
    const accounts = user?.accounts || []
    const groupedCalendars = groupBy(
      Object.values(calendars.calendarsById),
      (cal) => cal.account_id
    )

    return accounts.map((account) => {
      const calendars = groupedCalendars.get(account.id)
      if (!calendars) {
        return
      }

      return (
        <Accordion defaultIndex={0} key={account.id} allowToggle={true}>
          <AccordionItem border="0" mt="1">
            <AccordionButton height="8" p="1" display="flex" justifyContent="space-between">
              <Flex alignItems="center">
                <CalendarLogo source={account.provider} size={22} />
                <Text fontSize="xs" pl="2" color="gray.600" fontWeight="md">
                  {account.email}
                </Text>
              </Flex>
              <AccordionIcon color="gray.600" />
            </AccordionButton>

            <AccordionPanel pt="0" pb="0" pr="0">
              <CalendarList
                calendars={calendars}
                onSelectCalendar={onSelectCalendar}
                onRemoveFromList={(calendarId) => {
                  setConfirmDeleteCalendarId(calendarId)
                }}
                onClickEdit={(calendarId) => {
                  setEditingCalendar({
                    calendarId: calendarId,
                    accountId: account.id,
                  })
                }}
              />

              <Button
                fontSize={'xs'}
                color="gray.600"
                fontWeight="normal"
                variant="link"
                onClick={() => {
                  setEditingCalendar({
                    calendarId: null,
                    accountId: account.id,
                  })
                }}
                float="left"
                m="2"
              >
                <FiPlus /> add calendar
              </Button>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )
    })
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

  return (
    <>
      <ConfirmDeleteCalendarAlert
        calendarId={confirmDeleteCalendarId}
        onClose={() => setConfirmDeleteCalendarId(undefined)}
        onDelete={(calendarId) => onDeleteCalendar(calendarId)}
        cancelRef={confirmDeleteCancelRef}
      />

      {renderEditingCalendarModal()}
      {renderAccountList()}
    </>
  )
}
