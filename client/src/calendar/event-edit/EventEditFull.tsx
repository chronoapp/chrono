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
} from '@chakra-ui/react'

import produce from 'immer'
import * as dates from '@/util/dates'
import moment from 'moment'
import { getAuthToken, getEvent } from '@/util/Api'

import { FiMail } from 'react-icons/fi'
import { FiCalendar, FiAlignLeft, FiClock, FiChevronDown } from 'react-icons/fi'

import { EventActionContext, EditRecurringAction } from '@/calendar/EventActionContext'
import { CalendarsContext } from '@/contexts/CalendarsContext'
import Event, { UNSAVED_EVENT_ID } from '@/models/Event'
import { Label } from '@/models/Label'
import { format, fullDayFormat } from '@/util/localizer'
import ContentEditable from '@/lib/ContentEditable'
import { LabelTag } from '@/components/LabelTag'
import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'

import { addNewLabels } from '@/calendar/utils/LabelUtils'
import { getSplitRRules } from '@/calendar/utils/RecurrenceUtils'
import SelectCalendar from './SelectCalendar'
import RecurringEventEditor from './RecurringEventEditor'
import TaggableInput from './TaggableInput'
import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import useEventService from './useEventService'

/**
 * Full view for event editing.
 */
export default function EventEditFull(props: { event: Event }) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const { saveEvent, updateEvent } = useEventService()

  // Event data and overrides
  const [event, setEvent] = useState(props.event)

  const defaultDays = event.all_day ? Math.max(dates.diff(event.end, event.start, 'day'), 1) : 1
  const [recurrences, setRecurrences] = useState<string | null>(
    event.recurrences ? event.recurrences.join('\n') : null
  )

  const recurringAction = eventActions.eventState.editingEvent?.editRecurringAction
  const isUnsavedEvent = event.id === UNSAVED_EVENT_ID
  const isExistingRecurringEvent = !isUnsavedEvent && recurrences

  function getEventData(): Event {
    if (recurrences) {
      return { ...event, recurrences: [recurrences] }
    } else {
      return event
    }
  }

  async function onSaveEvent() {
    const eventData = getEventData()

    if (!event.recurring_event_id) {
      throw Error('Could not find recurring event')
    }

    if (!isExistingRecurringEvent) {
      // Update the individual event
      return await saveEvent(eventData)
    } else {
      switch (recurringAction) {
        case 'ALL':
          const parent = await getEvent(getAuthToken(), event.recurring_event_id)
          return await updateEvent({ ...parent, recurrences: [recurrences] })

        case 'SINGLE':
          return await saveEvent(eventData)

        case 'THIS_AND_FOLLOWING':
          /**
           * To update this event and all following events, we need to split the recurrence into:
           * 1) The recurrence up to this event. We then use the recurrence to update the parent event.
           * 2) The recurrence from this event onwards, to create a new series of events.
           */

          // 1) Update the base event's recurrence only
          const parentEvent = await getEvent(getAuthToken(), event.recurring_event_id)
          const rules = getSplitRRules(
            event.recurrences!.join('\n'),
            parentEvent.start,
            event.start
          )
          const updatedParentEvent = { ...parentEvent, recurrences: [rules.start.toString()] }
          const req1 = updateEvent(updatedParentEvent)

          // 2) Create a new recurring event for the the rest of the events
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
          <div className="is-flex is-align-items-center">
            <span className="mr-2" style={{ width: '1.25em' }} />
            <TaggableInput
              labels={labels}
              title={event.title}
              wrapperCls={'has-width-100'}
              portalCls={'.cal-event-modal-container'}
              isHeading={false}
              placeholder={!event.title ? Event.getDefaultTitle(event) : ''}
              handleChange={(title, labelIds: number[]) => {
                const updatedLabels = addNewLabels(labelState.labelsById, event.labels, labelIds)
                const updatedEvent = { ...event, title: title, labels: updatedLabels }
                setEvent(updatedEvent)
              }}
              onBlur={() => {
                eventActions.eventDispatch({ type: 'UPDATE_EDIT_EVENT', payload: event })
              }}
            />
          </div>

          <div className="is-flex is-align-items-center is-flex-wrap-wrap">
            <span className="mr-2" style={{ width: '1.25em' }} />
            {event.labels.map((label) => (
              <div key={label.id} className="mt-2">
                <LabelTag
                  label={label}
                  allowEdit={true}
                  onClickDelete={(e) => {
                    const rmIdx = event.labels.indexOf(label)
                    const updatedLabels = produce(event.labels, (labels) => {
                      labels.splice(rmIdx, 1)
                    })
                    setEvent({ ...event, labels: updatedLabels })
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 is-flex is-align-items-center">
            <FiMail className="mr-2" size={'1.25em'} />
            <input
              className="input"
              type="email"
              placeholder="participants"
              value="todo"
              onChange={(e) => {}}
            />
          </div>

          <div className="mt-2 is-flex is-align-items-center">
            <FiClock className="mr-2" size={'1.2em'} />
            <input
              className="input is-small"
              type="date"
              value={format(event.start, 'YYYY-MM-DD')}
              onChange={(e) => {
                const m = moment(e.target.value, 'YYYY-MM-DD')
                const duration = dates.diff(event.end, event.start, 'minutes')
                const start = dates.merge(m.toDate(), event.start)
                const end = dates.add(start, duration, 'minutes')

                const updatedEvent = event.all_day
                  ? {
                      ...event,
                      start,
                      end,
                      start_day: fullDayFormat(start),
                      end_day: fullDayFormat(end),
                    }
                  : { ...event, start, end }

                setEvent(updatedEvent)
                eventActions.setSelectedDate(start)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
              style={{ flex: 1 }}
            />
            {event.all_day && (
              <TimeSelectFullDay
                days={defaultDays}
                startDate={event.start}
                onSelectNumDays={(days) => {
                  const endDate = dates.add(event.start, days, 'day')
                  const updatedEvent = {
                    ...event,
                    end: endDate,
                    end_day: fullDayFormat(endDate),
                  }
                  setEvent(updatedEvent)
                }}
              />
            )}

            {!event.all_day && (
              <TimeSelect
                start={event.start}
                end={event.end}
                onSelectStartDate={(date) => {
                  const event = { ...props.event, start: date }
                  setEvent({ ...event, start: date })
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: event,
                  })
                }}
                onSelectEndDate={(date) => {
                  const event = { ...props.event, end: date }
                  setEvent({ ...event, end: date })
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: event,
                  })
                }}
              />
            )}

            <Checkbox
              ml="1"
              defaultChecked={event.all_day}
              onChange={(e) => {
                const isAllDay = e.target.checked

                let updatedEvent
                if (isAllDay) {
                  const start = dates.startOf(event.start, 'day')
                  const end = dates.endOf(event.start, 'day')

                  updatedEvent = {
                    ...event,
                    all_day: isAllDay,
                    start,
                    end,
                    start_day: fullDayFormat(start),
                    end_day: fullDayFormat(end),
                  }
                } else {
                  const start = dates.startOf(event.start, 'day')
                  const end = dates.add(start, 1, 'hours')

                  updatedEvent = {
                    ...event,
                    all_day: isAllDay,
                    start,
                    end,
                    start_day: null,
                    end_day: null,
                  }
                }

                setEvent(updatedEvent)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
            >
              All day
            </Checkbox>
          </div>

          {(recurringAction !== 'SINGLE' || isUnsavedEvent) && (
            <RecurringEventEditor
              initialDate={event.original_start || event.start}
              initialRulestr={recurrences}
              onChange={(rules) => {
                console.log(`Rule Updated: ${rules}`)
                if (rules) {
                  setRecurrences(rules.toString())
                } else {
                  setRecurrences(null)
                }
              }}
            />
          )}

          <div className="mt-2 is-flex is-align-items-center">
            <Box mr="2">
              <FiCalendar size={'1.25em'} />
            </Box>
            <SelectCalendar
              defaultCalendarId={event.calendar_id}
              calendarsById={calendarContext.calendarsById}
              onChange={(value) => {
                const updatedEvent = { ...event, calendar_id: value }
                setEvent(updatedEvent)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
            />
          </div>

          <div className="mt-2 is-flex is-align-items-top">
            <FiAlignLeft className="mr-2" size={'1.25em'} />

            <ContentEditable
              className="cal-event-edit-description"
              html={event.description || ''}
              onChange={(e) => setEvent({ ...event, description: e.target.value })}
              style={{ minHeight: '4em' }}
            />
          </div>
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
