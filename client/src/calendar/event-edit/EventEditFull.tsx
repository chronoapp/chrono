import { useState } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'

import {
  Button,
  Text,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Checkbox,
  Input,
  Flex,
} from '@chakra-ui/react'

import produce from 'immer'
import { FiMail, FiVideo, FiMapPin, FiBriefcase, FiBell } from 'react-icons/fi'
import { FiCalendar, FiAlignLeft, FiClock } from 'react-icons/fi'

import { ChronoUnit } from '@js-joda/core'
import * as dates from '@/util/dates-joda'
import { formatFullDay, yearStringToDate } from '@/util/localizer-joda'

import Event from '@/models/Event'
import Contact from '@/models/Contact'
import Calendar from '@/models/Calendar'
import { Label } from '@/models/Label'
import EventParticipant from '@/models/EventParticipant'
import CalendarAccount from '@/models/CalendarAccount'

import { labelsState } from '@/state/LabelsState'
import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { EditingEvent, EventUpdateContext } from '@/state/EventsState'
import { userState } from '@/state/UserState'
import { calendarViewState } from '@/state/CalendarViewState'

import { addNewLabels } from '@/calendar/utils/LabelUtils'
import ContentEditable from '@/lib/ContentEditable'
import { LabelTag } from '@/components/LabelTag'

import { mergeParticipants } from './EventEditUtils'
import SelectCalendar from './SelectCalendar'
import RecurringEventEditor from './RecurringEventEditor'
import TaggableInput from './TaggableInput'
import TimeRangeSelect from './TimeRangeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import { EventService } from './useEventService'
import EventFields from './EventFields'
import ParticipantList from './ParticipantList'
import ConferenceList from './ConferenceList'
import { LocationInput } from './LocationInput'
import SelectVisibilityTransparency from './SelectVisibilityTransparency'
import SelectReminders from './SelectReminders'

import TagDropdown from './TagAddDropdown'

/**
 * Full view for event editing.
 */
export default function EventEditFull(props: {
  editingEvent: EditingEvent
  eventService: EventService
}) {
  const eventActions = useEventActions()
  const labelState = useRecoilValue(labelsState)
  const calendarsById = useRecoilValue(calendarsState).calendarsById
  const setCalendarView = useSetRecoilState(calendarViewState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

  const { event } = props.editingEvent
  const originalCalendarId = event.syncStatus === 'SYNCED' ? event.calendar_id : null
  const user = useRecoilValue(userState)

  // Event data and overrides
  const [eventFields, setEventFields] = useState(
    new EventFields(
      event.title,
      event.description || '',
      event.start,
      event.end,
      event.labels,
      event.calendar_id,
      event.all_day,
      event.start_day,
      event.end_day,
      event.organizer,
      event.recurrences ? event.recurrences.join('\n') : null,
      event.guests_can_modify,
      event.guests_can_invite_others,
      event.guests_can_see_other_guests,
      event.conference_data,
      event.location,
      event.visibility,
      event.transparency,
      event.use_default_reminders,
      event.reminders
    )
  )
  const [participants, setParticipants] = useState<EventParticipant[]>(event.participants)

  // Derived Properties
  const isUnsavedEvent = event.syncStatus === 'NOT_SYNCED'

  function getUpdatedEvent(): Event {
    return {
      ...event,
      ...EventFields.getMutableEventFields(eventFields),
      participants: participants,
    }
  }

  /**
   * Include event conferencing separately, since we need to maintain
   * the original conferencing solution so the user can switch back to it.
   */
  function getUpdatedEventWithConferencing(): Event {
    return {
      ...getUpdatedEvent(),
      conference_data: eventFields.conferenceData,
    }
  }

  function getSelectedCalendar(calendarId: string): Calendar {
    const calendar = calendarsById[calendarId]
    if (calendar) {
      return calendar
    } else {
      return primaryCalendar!
    }
  }

  /**
   * This could be a new event, or an existing event that has been edited.
   */
  async function onSaveEvent() {
    const originalEvent = props.editingEvent.originalEvent
    const updatedEvent = getUpdatedEventWithConferencing()

    const hasParticipants =
      Event.hasNonOrganizerParticipants(originalEvent) ||
      Event.hasNonOrganizerParticipants(updatedEvent)
    const isRecurringEvent = originalEvent.recurring_event_id !== null
    const showConfirmDialog = hasParticipants || isRecurringEvent

    const recurrenceString = (updatedEvent.recurrences || []).join('\n')
    const originalRecurrenceString = (originalEvent.recurrences || []).join('\n')
    const hasRecurrenceUpdate = recurrenceString !== originalRecurrenceString

    if (showConfirmDialog) {
      const updateContext = {
        eventEditAction: isUnsavedEvent ? 'CREATE' : 'UPDATE',
        hasParticipants: hasParticipants,
        isRecurringEvent: originalEvent.recurring_event_id !== null,
        hasUpdatedRecurrenceString: hasRecurrenceUpdate,
      } as EventUpdateContext

      eventActions.updateEditingEvent(updatedEvent)
      eventActions.showConfirmDialog(updateContext, updatedEvent)
    } else {
      // Update the individual event directly.
      return await props.eventService.saveEvent(updatedEvent)
    }
  }

  const labels: Label[] = Object.values(labelState.labelsById)
  const selectedCalendar = getSelectedCalendar(eventFields.calendarId)

  /**
   * Since moving events between accounts isn't supported yet,
   * only show calendars from the same account as the original calendar.
   */
  function getCalendarAccounts(): CalendarAccount[] {
    let accounts: CalendarAccount[] = user?.accounts || []
    if (originalCalendarId) {
      const originalCalendar = calendarsById[originalCalendarId]
      accounts = accounts.filter((account) => account.id === originalCalendar.account_id) || []
    }

    return accounts
  }

  return (
    <Modal size="3xl" isOpen={true} onClose={eventActions.cancelSelect}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pb="2" fontSize={'md'}>
          Edit Event
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody maxHeight="3xl">
          <Flex alignItems="center">
            <Box mr="2" width="1em"></Box>

            <TaggableInput
              labels={labels}
              title={eventFields.title}
              portalCls={'.cal-event-modal-container'}
              isHeading={false}
              placeholder={'Event title'}
              handleChange={(title, labelIds: string[]) => {
                const updatedLabels = addNewLabels(
                  labelState.labelsById,
                  eventFields.labels,
                  labelIds
                )
                setEventFields({ ...eventFields, title, labels: updatedLabels })
              }}
              onBlur={() => {
                eventActions.updateEditingEvent(getUpdatedEvent())
              }}
              onUpdateContacts={(contacts: Contact[]) => {
                const updatedParticipants = mergeParticipants(
                  selectedCalendar,
                  participants,
                  contacts.map((c) => EventParticipant.fromContact(c))
                )
                setParticipants(updatedParticipants)
              }}
            />
          </Flex>

          <Flex alignItems="center" flexWrap="wrap">
            <Box w="1em" mr="2" />
            {eventFields.labels.map((label) => (
              <div key={label.id} className="tags">
                <LabelTag
                  label={label}
                  onClickDelete={(e) => {
                    const rmIdx = eventFields.labels.indexOf(label)
                    const updatedLabels = produce(eventFields.labels, (labels) => {
                      labels.splice(rmIdx, 1)
                    })
                    setEventFields({ ...eventFields, labels: updatedLabels })
                  }}
                />
              </div>
            ))}
            {!user?.flags.DISABLE_TAGS && (
              <TagDropdown eventFields={eventFields} setEventFields={setEventFields} />
            )}
          </Flex>

          <Flex alignItems="center" mt="3" justifyContent="left" color="gray.700">
            <Box mr="2">
              <FiClock size={'1em'} />
            </Box>

            <Flex>
              <Input
                type="date"
                size="sm"
                width="fit-content"
                border="0"
                variant="flushed"
                mr="2"
                value={formatFullDay(eventFields.start)}
                onChange={(e) => {
                  const duration = dates.diff(
                    eventFields.end,
                    eventFields.start,
                    ChronoUnit.MINUTES
                  )
                  const start = dates.merge(yearStringToDate(e.target.value), eventFields.start)
                  const end = dates.add(start, duration, ChronoUnit.MINUTES)

                  const updatedFields = eventFields.allDay
                    ? {
                        ...eventFields,
                        start,
                        end,
                        startDay: formatFullDay(start),
                        endDay: formatFullDay(end),
                      }
                    : { ...eventFields, start, end }

                  setEventFields(updatedFields)
                  const updatedEvent = {
                    ...event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }

                  setCalendarView((prev) => {
                    return { ...prev, selectedDate: start }
                  })
                  eventActions.updateEditingEvent(updatedEvent)
                }}
                style={{ flex: 1 }}
              />

              {eventFields.allDay && (
                <Input
                  ml="2"
                  type="date"
                  size="sm"
                  width="fit-content"
                  border="0"
                  variant="flushed"
                  value={formatFullDay(dates.subtract(eventFields.end, 1, ChronoUnit.DAYS))}
                  onChange={(e) => {
                    const duration = dates.diff(
                      eventFields.end,
                      eventFields.start,
                      ChronoUnit.MINUTES
                    )

                    const end = dates.merge(
                      dates.add(yearStringToDate(e.target.value), 1, ChronoUnit.DAYS),
                      eventFields.start
                    )

                    let start
                    if (dates.lt(end, eventFields.start)) {
                      // Move the start date back, keep the duration
                      start = dates.subtract(end, duration, ChronoUnit.MINUTES)
                    } else {
                      // Extend the duration
                      start = eventFields.start
                    }

                    const updatedFields = eventFields.allDay
                      ? {
                          ...eventFields,
                          start,
                          end,
                          startDay: formatFullDay(start),
                          endDay: formatFullDay(end),
                        }
                      : { ...eventFields, start, end }

                    setEventFields(updatedFields)
                    const updatedEvent = {
                      ...event,
                      ...EventFields.getMutableEventFields(updatedFields),
                    }

                    setCalendarView((prev) => {
                      return { ...prev, selectedDate: start }
                    })
                    eventActions.updateEditingEvent(updatedEvent)
                  }}
                />
              )}
            </Flex>

            {!eventFields.allDay && (
              <TimeRangeSelect
                start={eventFields.start}
                end={eventFields.end}
                onSelectStartDate={(date) => {
                  const updatedFields = { ...eventFields, start: date }
                  setEventFields(updatedFields)

                  const updatedEvent = {
                    ...event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }
                  eventActions.updateEditingEvent(updatedEvent)
                }}
                onSelectEndDate={(date) => {
                  const updatedFields = { ...eventFields, end: date }
                  setEventFields(updatedFields)

                  const updatedEvent = {
                    ...event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }
                  eventActions.updateEditingEvent(updatedEvent)
                }}
              />
            )}

            <Checkbox
              ml="2"
              fontSize={'sm'}
              defaultChecked={eventFields.allDay}
              onChange={(e) => {
                const isAllDay = e.target.checked

                let newEventFields
                if (isAllDay) {
                  const start = dates.startOf(eventFields.start, ChronoUnit.DAYS)
                  const end = dates.add(start, 1, ChronoUnit.DAYS)

                  newEventFields = {
                    ...eventFields,
                    allDay: isAllDay,
                    start,
                    end,
                    startDay: formatFullDay(start),
                    endDay: formatFullDay(end),
                  }
                } else {
                  const start = dates.startOf(eventFields.start, ChronoUnit.DAYS)
                  const end = dates.add(start, 1, ChronoUnit.HOURS)

                  newEventFields = {
                    ...eventFields,
                    allDay: isAllDay,
                    start,
                    end,
                    startDay: null,
                    endDay: null,
                  }
                }
                setEventFields(newEventFields)

                const updatedEvent = {
                  ...event,
                  ...EventFields.getMutableEventFields(newEventFields),
                }
                eventActions.updateEditingEvent(updatedEvent)
              }}
            >
              All day
            </Checkbox>
          </Flex>

          <RecurringEventEditor
            initialDate={event.original_start || eventFields.start}
            initialRulestr={eventFields.recurrences}
            onChange={(rules) => {
              console.log(`Rule Updated: ${rules}`)

              if (rules) {
                setEventFields({ ...eventFields, recurrences: rules.toString() })
              } else {
                setEventFields({ ...eventFields, recurrences: null })
              }
            }}
          />

          <Flex mt="3">
            <Flex justifyContent="left">
              <Box mt="1" mr="2" color="gray.700">
                <FiMail size={'1em'} />
              </Box>
              <Box w="28em">
                <ParticipantList
                  calendar={getSelectedCalendar(eventFields.calendarId)}
                  organizer={eventFields.organizer}
                  readonly={false}
                  participants={participants}
                  onUpdateParticipants={(updatedParticipants) =>
                    setParticipants(updatedParticipants)
                  }
                />
              </Box>
            </Flex>

            {participants.length > 0 && (
              <Flex ml="6" direction={'column'}>
                <Text mb="1" fontSize={'sm'}>
                  Guests can
                </Text>
                <Checkbox
                  lineHeight={1.75}
                  size="sm"
                  isChecked={eventFields.guestsCanModify}
                  onChange={(e) => {
                    const guestsCanModify = e.target.checked
                    if (guestsCanModify) {
                      setEventFields({
                        ...eventFields,
                        guestsCanModify,
                        guestsCanInviteOthers: true,
                        guestsCanSeeOtherGuests: true,
                      })
                    } else {
                      setEventFields({ ...eventFields, guestsCanModify })
                    }
                  }}
                >
                  Modify event
                </Checkbox>
                <Checkbox
                  lineHeight={1.75}
                  size="sm"
                  disabled={eventFields.guestsCanModify}
                  isChecked={eventFields.guestsCanInviteOthers}
                  onChange={(e) => {
                    const guestsCanInviteOthers = e.target.checked
                    setEventFields({ ...eventFields, guestsCanInviteOthers })
                  }}
                >
                  Invite guests
                </Checkbox>
                <Checkbox
                  lineHeight={1.75}
                  size="sm"
                  disabled={eventFields.guestsCanModify}
                  isChecked={eventFields.guestsCanSeeOtherGuests}
                  onChange={(e) => {
                    const guestsCanSeeOtherGuests = e.target.checked
                    setEventFields({ ...eventFields, guestsCanSeeOtherGuests })
                  }}
                >
                  See guest list
                </Checkbox>
              </Flex>
            )}
          </Flex>

          <Flex mt="3">
            <Box mt="1" mr="2" color="gray.700">
              <FiVideo size={'1em'} />
            </Box>
            <ConferenceList
              event={event}
              conferenceData={eventFields.conferenceData}
              onSelectConference={(conferenceData) => {
                const updatedFields = {
                  ...eventFields,
                  conferenceData: conferenceData,
                }
                setEventFields(updatedFields)
              }}
              readonly={false}
            />
          </Flex>

          <Flex mt="3" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiMapPin size="1em" />
            </Box>

            <Box w="28em">
              <LocationInput
                location={eventFields.location || ''}
                onUpdateLocation={(location) => {
                  setEventFields({ ...eventFields, location: location })
                }}
              />
            </Box>
          </Flex>

          <Flex alignItems="center" mt="3">
            <Box mr="2" color="gray.700">
              <FiCalendar size={'1em'} />
            </Box>
            <SelectCalendar
              accounts={getCalendarAccounts()}
              selectedCalendarId={eventFields.calendarId}
              onChange={(calendar) => {
                const updatedFields = {
                  ...eventFields,
                  organizer: EventParticipant.fromCreatorOrOrganizer(
                    calendar.email,
                    calendar.summary
                  ),
                  calendarId: calendar.id,
                }
                setEventFields(updatedFields)

                const updatedEvent = {
                  ...event,
                  ...EventFields.getMutableEventFields(updatedFields),
                }
                eventActions.updateEditingEvent(updatedEvent)
              }}
            />
          </Flex>

          <Flex mt="3" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiBriefcase size="1em" />
            </Box>

            <Box>
              <SelectVisibilityTransparency
                visibility={eventFields.visibility}
                transparency={eventFields.transparency}
                onVisibilityChange={(visibility) => {
                  setEventFields({ ...eventFields, visibility })
                }}
                onTransparencyChange={(transparency) => {
                  setEventFields({ ...eventFields, transparency })
                }}
              />
            </Box>
          </Flex>

          <Flex mt="3" alignItems={'top'}>
            <Box mt="1" mr="2" color="gray.600">
              <FiBell size="1em" />
            </Box>
            <SelectReminders
              useDefaultReminders={eventFields.useDefaultReminders}
              defaultReminders={selectedCalendar.reminders}
              reminders={eventFields.reminders}
              onUpdateReminders={(reminders) => {
                setEventFields({ ...eventFields, reminders, useDefaultReminders: false })
              }}
              readonly={false}
            />
          </Flex>

          <Flex alignItems="top" mt="3" color="gray.700">
            <Box mt="1" mr="2" color="gray.600">
              <FiAlignLeft size={'1em'} />
            </Box>

            <ContentEditable
              className="cal-event-edit-description"
              placeholder="Event description"
              html={eventFields.description}
              onChange={(e) => setEventFields({ ...eventFields, description: e.target.value })}
              style={{ minHeight: '4em' }}
            />
          </Flex>
        </ModalBody>

        <ModalFooter>
          <Button variant={'ghost'} mr={3} onClick={eventActions.cancelSelect} size="md">
            Cancel
          </Button>

          <Button colorScheme="primary" onClick={onSaveEvent} size="md">
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
