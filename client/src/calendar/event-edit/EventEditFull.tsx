import React, { useState } from 'react'
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
import moment from 'moment'
import { FiMail, FiVideo, FiMapPin, FiBriefcase, FiBell } from 'react-icons/fi'
import { FiCalendar, FiAlignLeft, FiClock } from 'react-icons/fi'

import * as dates from '@/util/dates'
import Event from '@/models/Event'
import Contact from '@/models/Contact'
import Calendar from '@/models/Calendar'
import { Label } from '@/models/Label'
import EventParticipant from '@/models/EventParticipant'

import { labelsState } from '@/state/LabelsState'
import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { displayState, editingEventState, EventUpdateContext } from '@/state/EventsState'

import { format, fullDayFormat } from '@/util/localizer'
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

/**
 * Full view for event editing.
 */
export default function EventEditFull(props: { event: Event; eventService: EventService }) {
  const eventActions = useEventActions()
  const editingEvent = useRecoilValue(editingEventState)
  const labelState = useRecoilValue(labelsState)
  const calendarsById = useRecoilValue(calendarsState).calendarsById
  const setDisplay = useSetRecoilState(displayState)
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)

  // Event data and overrides
  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      props.event.calendar_id,
      props.event.all_day,
      props.event.start_day,
      props.event.end_day,
      props.event.organizer,
      props.event.recurrences ? props.event.recurrences.join('\n') : null,
      props.event.guests_can_modify,
      props.event.guests_can_invite_others,
      props.event.guests_can_see_other_guests,
      props.event.conference_data,
      props.event.location,
      props.event.visibility,
      props.event.transparency,
      props.event.use_default_reminders,
      props.event.reminders
    )
  )
  const [participants, setParticipants] = useState<EventParticipant[]>(props.event.participants)

  const defaultDays = eventFields.allDay
    ? Math.max(dates.diff(eventFields.start, eventFields.end, 'day'), 1)
    : 1

  // Derived Properties
  const recurringAction = editingEvent?.editRecurringAction
  const isUnsavedEvent = props.event.syncStatus === 'NOT_SYNCED'
  const isExistingRecurringEvent = !isUnsavedEvent && props.event.recurrences != null

  function getUpdatedEvent(): Event {
    return {
      ...props.event,
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

  async function onSaveEvent() {
    const updatedEvent = getUpdatedEventWithConferencing()

    if (Event.showConfirmationModal(updatedEvent)) {
      const updateContext = {
        eventEditAction: 'UPDATE',
        isRecurringEvent: updatedEvent.recurring_event_id !== null,
        hasParticipants: updatedEvent.participants.length > 0,
      } as EventUpdateContext

      eventActions.updateEditingEvent(updatedEvent)
      eventActions.showConfirmDialog(updateContext, updatedEvent)
    } else {
      // Update the individual event
      return await props.eventService.saveEvent(updatedEvent)
    }
  }

  const labels: Label[] = Object.values(labelState.labelsById)
  const selectedCalendar = getSelectedCalendar(eventFields.calendarId)

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
            <span className="mr-2" style={{ width: '1em' }} />
            <TaggableInput
              labels={labels}
              title={eventFields.title}
              wrapperCls={'has-width-100'}
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
              <div key={label.id} className="mt-2">
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
          </Flex>

          <Flex alignItems="center" mt="3" justifyContent="left" color="gray.700">
            <FiClock className="mr-2" size={'1em'} />
            <Input
              type="date"
              size="sm"
              width="fit-content"
              border="0"
              variant="flushed"
              mr="2"
              value={format(eventFields.start, 'YYYY-MM-DD')}
              onChange={(e) => {
                const m = moment(e.target.value, 'YYYY-MM-DD')
                const duration = dates.diff(eventFields.end, eventFields.start, 'minutes')
                const start = dates.merge(m.toDate(), eventFields.start)
                const end = dates.add(start, duration, 'minutes')

                const updatedFields = eventFields.allDay
                  ? {
                      ...eventFields,
                      start,
                      end,
                      startDay: fullDayFormat(start),
                      endDay: fullDayFormat(end),
                    }
                  : { ...eventFields, start, end }

                setEventFields(updatedFields)
                const updatedEvent = {
                  ...props.event,
                  ...EventFields.getMutableEventFields(updatedFields),
                }

                setDisplay((prev) => {
                  return { ...prev, selectedDate: start }
                })
                eventActions.updateEditingEvent(updatedEvent)
              }}
              style={{ flex: 1 }}
            />
            {eventFields.allDay && (
              <TimeSelectFullDay
                days={defaultDays}
                startDate={eventFields.start}
                onSelectNumDays={(days) => {
                  const endDate = dates.add(eventFields.start, days, 'day')
                  setEventFields({
                    ...eventFields,
                    end: endDate,
                    endDay: fullDayFormat(endDate),
                  })
                }}
              />
            )}

            {!eventFields.allDay && (
              <TimeRangeSelect
                start={eventFields.start}
                end={eventFields.end}
                onSelectStartDate={(date) => {
                  const updatedFields = { ...eventFields, start: date }
                  setEventFields(updatedFields)

                  const updatedEvent = {
                    ...props.event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }
                  eventActions.updateEditingEvent(updatedEvent)
                }}
                onSelectEndDate={(date) => {
                  const updatedFields = { ...eventFields, end: date }
                  setEventFields(updatedFields)

                  const updatedEvent = {
                    ...props.event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }
                  eventActions.updateEditingEvent(updatedEvent)
                }}
              />
            )}

            <Checkbox
              ml="1"
              fontSize={'sm'}
              defaultChecked={eventFields.allDay}
              onChange={(e) => {
                const isAllDay = e.target.checked

                let newEventFields
                if (isAllDay) {
                  const start = dates.startOf(eventFields.start, 'day')
                  const end = dates.endOf(eventFields.start, 'day')

                  newEventFields = {
                    ...eventFields,
                    allDay: isAllDay,
                    start,
                    end,
                    startDay: fullDayFormat(start),
                    endDay: fullDayFormat(end),
                  }
                } else {
                  const start = dates.startOf(eventFields.start, 'day')
                  const end = dates.add(start, 1, 'hours')

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
                  ...props.event,
                  ...EventFields.getMutableEventFields(newEventFields),
                }
                eventActions.updateEditingEvent(updatedEvent)
              }}
            >
              All day
            </Checkbox>
          </Flex>

          <RecurringEventEditor
            initialDate={props.event.original_start || eventFields.start}
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
              originalConferenceData={props.event.conference_data}
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
              defaultCalendarId={eventFields.calendarId}
              calendarsById={calendarsById}
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
                  ...props.event,
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
            <FiAlignLeft className="mr-2" size={'1em'} />

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
