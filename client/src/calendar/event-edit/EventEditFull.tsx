import React, { useContext, useState } from 'react'
import {
  Button,
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Checkbox,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuDivider,
  Input,
  Flex,
} from '@chakra-ui/react'

import produce from 'immer'
import moment from 'moment'
import { FiMail } from 'react-icons/fi'
import { FiCalendar, FiAlignLeft, FiClock, FiChevronDown } from 'react-icons/fi'

import makeId from '@/lib/js-lib/makeId'
import * as dates from '@/util/dates'
import * as API from '@/util/Api'
import { EventActionContext, EditRecurringAction } from '@/calendar/EventActionContext'
import { CalendarsContext } from '@/contexts/CalendarsContext'
import Event, { UNSAVED_EVENT_ID } from '@/models/Event'
import Contact from '@/models/Contact'
import { Label } from '@/models/Label'

import { format, fullDayFormat } from '@/util/localizer'
import ContentEditable from '@/lib/ContentEditable'
import { LabelTag } from '@/components/LabelTag'
import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'
import { addNewLabels } from '@/calendar/utils/LabelUtils'
import { getSplitRRules } from '@/calendar/utils/RecurrenceUtils'
import EventParticipant from '@/models/EventParticipant'

import SelectCalendar from './SelectCalendar'
import RecurringEventEditor from './RecurringEventEditor'
import TaggableInput from './TaggableInput'
import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import useEventService from './useEventService'
import EventFields from './EventFields'
import ParticipantList from './ParticipantList'

/**
 * Full view for event editing.
 */
export default function EventEditFull(props: { event: Event }) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const { saveEvent, updateEvent } = useEventService()

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
      props.event.recurrences ? props.event.recurrences.join('\n') : null
    )
  )
  const [participants, setParticipants] = useState<Partial<EventParticipant>[]>(
    props.event.participants
  )

  const defaultDays = eventFields.allDay
    ? Math.max(dates.diff(eventFields.start, eventFields.end, 'day'), 1)
    : 1

  // Derived Properties
  const recurringAction = eventActions.eventState.editingEvent?.editRecurringAction
  const isUnsavedEvent = props.event.id === UNSAVED_EVENT_ID
  const isExistingRecurringEvent = !isUnsavedEvent && props.event.recurrences != null

  function getEventData(): Event {
    return {
      ...props.event,
      ...EventFields.getMutableEventFields(eventFields),
      participants: participants.map((p) => EventParticipant.getMutableFields(p)),
    }
  }

  /**
   * Overrides the existing parent recurring event.
   * TODO: Update event start / end based on the offsets.
   */
  async function updateRecurringEvent(parent: Event) {
    const updatedParent = produce(parent, (event) => {
      event.title = eventFields.title
      event.description = eventFields.description
      event.labels = eventFields.labels
    })

    return await updateEvent(updatedParent)
  }

  async function onSaveEvent() {
    const eventData = getEventData()
    console.log(eventData)

    if (!isExistingRecurringEvent) {
      // Update the individual event
      return await saveEvent(eventData)
    } else {
      // Update a recurring event.
      if (!props.event.recurring_event_id || !props.event.original_start) {
        throw Error('Could not find recurring event')
      }

      switch (recurringAction) {
        case 'SINGLE':
          return await saveEvent(eventData)

        case 'ALL':
          const parent = await API.getEvent(API.getAuthToken(), props.event.recurring_event_id)
          return await updateRecurringEvent(parent)

        case 'THIS_AND_FOLLOWING':
          /**
           * To update this event and all following events, we need to split the recurrence into:
           * 1) The recurrence up to this event. We then use the recurrence to update the parent event.
           * 2) The recurrence from this event onwards, to create a new series of events.
           */
          const parentEvent = await API.getEvent(API.getAuthToken(), props.event.recurring_event_id)

          if (dates.eq(parentEvent.start, props.event.original_start)) {
            return updateRecurringEvent(parentEvent)
          } else {
            // 1) Update the base event's recurrence, cut off at the current event's original start date.
            const rules = getSplitRRules(
              props.event.recurrences!.join('\n'),
              parentEvent.start,
              props.event.original_start
            )
            const updatedParentEvent = { ...parentEvent, recurrences: [rules.start.toString()] }
            const req1 = updateEvent(updatedParentEvent)

            // 2) Create a new recurring event for the the rest of the events
            // TODO: Use the new recurrence this & following starting at this date.
            const thisAndFollowingEvent = {
              ...eventData,
              recurrences: [rules.end.toString()],
              id: UNSAVED_EVENT_ID,
              recurring_event_id: null,
            }
            const req2 = saveEvent(thisAndFollowingEvent, false)

            return Promise.all([req1, req2])
          }
      }
    }
  }

  const labels: Label[] = Object.values(labelState.labelsById)

  function recurringEventActionDescription(action: EditRecurringAction) {
    if (action === 'ALL') {
      return 'Editing all events in series'
    } else if (action === 'THIS_AND_FOLLOWING') {
      return 'Editing this and following events in series'
    } else if (action === 'SINGLE') {
      return 'Editing this event in series'
    }
  }

  function isExistingParticipant(contact: Contact) {
    return (
      participants.filter(
        (p) => (p.email && contact.email === p.email) || contact.id == p.contact_id
      ).length > 0
    )
  }

  function renderRecurringEventSelectionMenu() {
    if (!isExistingRecurringEvent || !recurringAction) {
      return
    }

    const currentSelection = recurringEventActionDescription(recurringAction)

    return (
      <Menu>
        <MenuButton
          ml="2"
          borderRadius="sm"
          size="sm"
          fontWeight="normal"
          variant="outline"
          as={Button}
          rightIcon={<FiChevronDown />}
        >
          {currentSelection}
        </MenuButton>

        <MenuList mt="-2">
          <MenuItem
            fontSize="sm"
            onClick={() =>
              eventActions.eventDispatch({
                type: 'UPDATE_EDIT_MODE',
                payload: {
                  editMode: 'FULL_EDIT',
                  editRecurringAction: 'SINGLE' as EditRecurringAction,
                },
              })
            }
          >
            This event
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() =>
              eventActions.eventDispatch({
                type: 'UPDATE_EDIT_MODE',
                payload: {
                  editMode: 'FULL_EDIT',
                  editRecurringAction: 'THIS_AND_FOLLOWING' as EditRecurringAction,
                },
              })
            }
          >
            This and following events
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() => {
              eventActions.eventDispatch({
                type: 'UPDATE_EDIT_MODE',
                payload: {
                  editMode: 'FULL_EDIT',
                  editRecurringAction: 'ALL' as EditRecurringAction,
                },
              })
            }}
          >
            All events
          </MenuItem>
        </MenuList>
      </Menu>
    )
  }

  return (
    <Modal
      size="3xl"
      isOpen={true}
      onClose={() => {
        eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
      }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Event {renderRecurringEventSelectionMenu()}</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <Flex alignItems="center">
            <span className="mr-2" style={{ width: '1.25em' }} />
            <TaggableInput
              labels={labels}
              title={eventFields.title}
              wrapperCls={'has-width-100'}
              portalCls={'.cal-event-modal-container'}
              isHeading={false}
              placeholder={Event.getDefaultTitle(eventFields.title)}
              handleChange={(title, labelIds: number[]) => {
                const updatedLabels = addNewLabels(
                  labelState.labelsById,
                  eventFields.labels,
                  labelIds
                )

                setEventFields({ ...eventFields, title, labels: updatedLabels })
              }}
              onBlur={() => {
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getEventData(),
                })
              }}
              onUpdateContacts={(contacts: Contact[]) => {
                const newParticipants = contacts
                  .filter((c) => !isExistingParticipant(c))
                  .map(
                    (c) =>
                      new EventParticipant(
                        makeId(),
                        c.email,
                        c.id,
                        'needsAction',
                        c.displayName,
                        c.photoUrl
                      )
                  )

                const updatedParticipants = [...participants, ...newParticipants]
                setParticipants(updatedParticipants)
              }}
            />
          </Flex>

          <Flex alignItems="center" flexWrap="wrap">
            <span className="mr-2" style={{ width: '1.25em' }} />
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

          <Flex alignItems="center" mt="2" justifyContent="left">
            <FiClock className="mr-2" size={'1.2em'} />
            <Input
              size="sm"
              type="date"
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

                eventActions.setSelectedDate(start)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
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
              <TimeSelect
                start={eventFields.start}
                end={eventFields.end}
                onSelectStartDate={(date) => {
                  const updatedFields = { ...eventFields, start: date }
                  setEventFields(updatedFields)

                  const updatedEvent = {
                    ...props.event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: updatedEvent,
                  })
                }}
                onSelectEndDate={(date) => {
                  const updatedFields = { ...eventFields, end: date }
                  setEventFields(updatedFields)

                  const updatedEvent = {
                    ...props.event,
                    ...EventFields.getMutableEventFields(updatedFields),
                  }
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: updatedEvent,
                  })
                }}
              />
            )}

            <Checkbox
              ml="1"
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
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
            >
              All day
            </Checkbox>
          </Flex>

          {(recurringAction !== 'SINGLE' || isUnsavedEvent) && (
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
          )}

          <Flex alignItems="center" mt="2" justifyContent="left">
            <FiMail className="mr-2" size={'1.25em'} />
            <Input variant="outline" placeholder="Add Participant" size="sm" />
          </Flex>

          <Flex alignItems="center" ml="7" mt="2" justifyContent="left">
            <ParticipantList
              participants={participants}
              onUpdateParticipants={(participants) => {
                setParticipants(participants)
              }}
            />
          </Flex>

          <Flex alignItems="center" mt="2">
            <Box mr="2">
              <FiCalendar size={'1.25em'} />
            </Box>
            <SelectCalendar
              defaultCalendarId={eventFields.calendarId}
              calendarsById={calendarContext.calendarsById}
              onChange={(value) => {
                const updatedFields = { ...eventFields, calendarId: value }
                setEventFields(updatedFields)

                const updatedEvent = {
                  ...props.event,
                  ...EventFields.getMutableEventFields(updatedFields),
                }
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
            />
          </Flex>

          <Flex alignItems="top" mt="2">
            <FiAlignLeft className="mr-2" size={'1.25em'} />

            <ContentEditable
              className="cal-event-edit-description"
              html={eventFields.description || ''}
              onChange={(e) => setEventFields({ ...eventFields, description: e.target.value })}
              style={{ minHeight: '4em' }}
            />
          </Flex>
        </ModalBody>

        <ModalFooter>
          <Button
            variant={'ghost'}
            mr={3}
            onClick={() => eventActions.eventDispatch({ type: 'CANCEL_SELECT' })}
          >
            Cancel
          </Button>

          <Button colorScheme="primary" onClick={onSaveEvent}>
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
