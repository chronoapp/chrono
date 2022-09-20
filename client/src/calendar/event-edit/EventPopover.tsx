import React, { useContext, useState, useEffect, createRef } from 'react'
import {
  Box,
  Flex,
  Button,
  Input,
  Checkbox,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
} from '@chakra-ui/react'
import { FiCalendar, FiClock, FiAlignLeft, FiTrash, FiChevronDown, FiPlus } from 'react-icons/fi'
import { RRule } from 'rrule'

import produce from 'immer'
import moment from 'moment'
import linkifyHtml from 'linkifyjs/html'

import * as dates from '@/util/dates'
import { MdClose } from 'react-icons/md'

import { format, fullDayFormat } from '@/util/localizer'
import { addNewLabels } from '@/calendar/utils/LabelUtils'
import { getSplitRRules } from '@/calendar/utils/RecurrenceUtils'

import Event from '@/models/Event'
import Calendar from '@/models/Calendar'
import EventParticipant from '@/models/EventParticipant'
import { Label } from '@/models/Label'
import { EditRecurringAction, EventActionContext } from '../EventActionContext'
import { CalendarsContext } from '@/contexts/CalendarsContext'
import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'
import { LabelTag } from '@/components/LabelTag'
import LabelTree from '@/components/LabelTree'
import * as API from '@/util/Api'

import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import SelectCalendar from './SelectCalendar'
import ContentEditable from '@/lib/ContentEditable'
import TaggableInput from './TaggableInput'
import { EventService } from './useEventService'
import EventFields from './EventFields'

interface IProps {
  event: Event
  eventService: EventService
}

function EventPopover(props: IProps) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const { labelState } = useContext<LabelContextType>(LabelContext)

  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      getSelectedCalendar(props.event.calendar_id)?.id,
      props.event.all_day,
      props.event.start_day,
      props.event.end_day,
      props.event.organizer,
      props.event.recurrences ? props.event.recurrences.join('\n') : null
    )
  )

  const defaultDays = eventFields.allDay
    ? Math.max(dates.diff(eventFields.end, eventFields.start, 'day'), 1)
    : 1

  const isExistingEvent = props.event.syncStatus !== 'NOT_SYNCED'
  const contentEditableRef = createRef<HTMLInputElement>()

  useEffect(() => {
    document.addEventListener('keydown', keyboardEvents)
    return function cleanup() {
      document.removeEventListener('keydown', keyboardEvents)
    }
  }, [eventFields])

  const isReadOnly = eventActions.eventState.editingEvent?.editMode == 'READ'
  return <Box boxShadow="2xl">{isReadOnly ? renderReadOnlyView() : renderEditView()}</Box>

  function keyboardEvents(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
        props.eventService.saveEvent(getUpdatedEvent(props.event, eventFields))
      }
    }
  }

  function getUpdatedEvent(e: Event, fields: EventFields) {
    const event = {
      ...e,
      ...EventFields.getMutableEventFields(fields),
    }

    return event
  }

  function renderEditEventButton() {
    if (props.event.recurring_event_id) {
      return (
        <Menu>
          <MenuButton
            ml="2"
            borderRadius="sm"
            size="sm"
            fontWeight="normal"
            colorScheme="primary"
            as={Button}
            rightIcon={<FiChevronDown />}
          >
            Edit
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
    } else {
      return (
        <Button
          size="sm"
          borderRadius="sm"
          fontWeight="normal"
          colorScheme="primary"
          onClick={() => {
            eventActions.eventDispatch({
              type: 'UPDATE_EDIT_MODE',
              payload: {
                editMode: 'FULL_EDIT',
                editRecurringAction: 'SINGLE' as EditRecurringAction,
              },
            })
          }}
        >
          Edit
        </Button>
      )
    }
  }

  function renderDeleteEventButton() {
    if (props.event.recurring_event_id) {
      return (
        <Menu>
          <MenuButton
            ml="2"
            borderRadius="sm"
            size="sm"
            fontWeight="normal"
            as={Button}
            leftIcon={<FiTrash />}
            rightIcon={<FiChevronDown />}
          >
            Delete
          </MenuButton>

          <MenuList mt="-2">
            <MenuItem
              fontSize="sm"
              onClick={() =>
                props.eventService.deleteEvent(props.event.calendar_id, props.event.id)
              }
            >
              This event
            </MenuItem>
            <MenuDivider m="0" />
            <MenuItem
              fontSize="sm"
              onClick={() => props.eventService.deleteThisAndFollowingEvents(props.event)}
            >
              This and following events
            </MenuItem>
            <MenuDivider m="0" />
            <MenuItem
              fontSize="sm"
              onClick={() => {
                props.event.recurring_event_id &&
                  props.eventService.deleteAllRecurringEvents(
                    props.event.calendar_id,
                    props.event.recurring_event_id
                  )
              }}
            >
              All events
            </MenuItem>
          </MenuList>
        </Menu>
      )
    } else {
      return (
        <Button
          ml="2"
          borderRadius="sm"
          size="sm"
          fontWeight="normal"
          leftIcon={<FiTrash />}
          onClick={() => props.eventService.deleteEvent(props.event.calendar_id, props.event.id)}
        >
          Delete
        </Button>
      )
    }
  }

  function getSelectedCalendar(calendarId: string): Calendar {
    const calendar = calendarContext.calendarsById[calendarId]
    if (calendar) {
      return calendar
    } else {
      return calendarContext.getPrimaryCalendar()
    }
  }

  function renderAddTagDropdown() {
    return (
      <Menu isLazy>
        {({ onClose }) => (
          <>
            <MenuButton
              mb="2"
              mt="1"
              borderRadius="xs"
              size="sm"
              fontWeight="normal"
              fontSize="sm"
              as={Button}
              variant="link"
              justifyContent="center"
              alignItems="center"
            >
              <Flex align="center">
                <FiPlus /> add tag
              </Flex>
            </MenuButton>

            <MenuList pl="1">
              <LabelTree
                allowEdit={false}
                onSelect={(label) => {
                  // const updatedLabels = [...eventFields.labels, label]
                  const updatedLabels = produce(eventFields.labels, (draft) => {
                    if (!draft.find((l) => l.id == label.id)) {
                      draft.push(label)
                    }
                  })

                  setEventFields({ ...eventFields, labels: updatedLabels })
                  onClose()
                }}
              />
            </MenuList>
          </>
        )}
      </Menu>
    )
  }

  function renderReadOnlyView() {
    const calendar = getSelectedCalendar(eventFields.calendarId)

    return (
      <div>
        <div className="cal-event-modal-header">
          <span
            className="mr-2 is-flex is-align-items-center"
            style={{ height: '100%' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <MdClose style={{ cursor: 'pointer' }} className="has-text-grey" />
          </span>
        </div>

        <div className="cal-event-modal is-flex is-flex-direction-column mb-3">
          <div className="has-text-grey-darker is-size-5">{props.event.title_short}</div>

          {props.event.labels && (
            <div style={{ display: 'flex' }}>
              {props.event.labels.map((label) => (
                <LabelTag key={label.id} label={label} />
              ))}
            </div>
          )}

          <div className="mt-2 is-flex is-align-items-center">
            <FiClock className="mr-2 is-flex-shrink-0" />
            <span>
              {format(eventFields.start, 'YYYY-MM-DD')} {format(eventFields.start, 'hh:mm')} -{' '}
              {format(eventFields.end, 'hh:mm')}
              {format(eventFields.end, 'A')}
            </span>
          </div>

          {props.event.description && (
            <div className="mt-2 is-flex is-align-items-flex-start">
              <FiAlignLeft className="mr-2 is-flex-shrink-0" />
              <Box
                maxW="100%"
                pr="4"
                dangerouslySetInnerHTML={{ __html: linkifyHtml(props.event.description) }}
              ></Box>
            </div>
          )}

          <div className="mt-2 is-flex is-align-items-center">
            <FiCalendar className="mr-2 is-flex-shrink-0" />
            <span>{calendar.summary}</span>
          </div>
        </div>

        {calendar.isWritable() && (
          <div className="ml-4 mb-3 is-flex">
            {renderEditEventButton()}
            {renderDeleteEventButton()}
          </div>
        )}
      </div>
    )
  }

  function renderEditView() {
    const labels: Label[] = Object.values(labelState.labelsById)

    return (
      <>
        <div className="cal-event-modal-header">
          <div
            className="mr-2 is-flex is-align-items-center"
            style={{ height: '100%' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <MdClose style={{ cursor: 'pointer' }} className="has-text-grey" />
          </div>
        </div>

        <div className="cal-event-modal is-flex is-flex-direction-column">
          <TaggableInput
            labels={labels}
            title={eventFields.title}
            portalCls={'.cal-event-modal-container'}
            isHeading={false}
            onBlur={() => {
              eventActions.eventDispatch({
                type: 'UPDATE_EDIT_EVENT',
                payload: getUpdatedEvent(props.event, eventFields),
              })
            }}
            handleChange={(title, labelIds: number[]) => {
              const updatedLabels = addNewLabels(
                labelState.labelsById,
                eventFields.labels,
                labelIds
              )
              setEventFields({ ...eventFields, title, labels: updatedLabels })
            }}
            onUpdateContacts={(contacts) => {
              console.log('TODO: onUpdateContacts')
            }}
          />

          <Flex mt="2" alignItems="center" flexWrap="wrap" justifyContent="left">
            {eventFields.labels.map((label) => (
              <Box mb="1" key={label.id}>
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
              </Box>
            ))}
            {renderAddTagDropdown()}
          </Flex>

          <Flex mt="2" alignItems="center">
            <FiClock className="mr-2" size={'1.2em'} />
            <Input
              ml="1"
              type="date"
              size="sm"
              maxWidth="15em"
              border="0"
              variant="flushed"
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
                eventActions.setSelectedDate(start)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getUpdatedEvent(props.event, updatedFields),
                })
              }}
            />
          </Flex>

          <Flex mt="2">
            <Box w="1.7em" />
            {eventFields.allDay && (
              <TimeSelectFullDay
                days={defaultDays}
                startDate={eventFields.start}
                onSelectNumDays={(days) => {
                  const endDate = dates.add(eventFields.start, days, 'day')
                  const updatedEventFields = {
                    ...eventFields,
                    end: endDate,
                    endDay: fullDayFormat(endDate),
                  }
                  setEventFields(updatedEventFields)

                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: getUpdatedEvent(props.event, updatedEventFields),
                  })
                }}
              />
            )}
            {!eventFields.allDay && (
              <TimeSelect
                start={eventFields.start}
                end={eventFields.end}
                onSelectStartDate={(date) => {
                  setEventFields({ ...eventFields, start: date })
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: { ...props.event, start: date },
                  })
                }}
                onSelectEndDate={(date) => {
                  setEventFields({ ...eventFields, end: date })
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: { ...props.event, end: date },
                  })
                }}
              />
            )}

            <Checkbox
              ml="1"
              checked={eventFields.allDay}
              colorScheme="primary"
              onChange={(e) => {
                let updatedFields
                const isAllDay = e.target.checked

                if (isAllDay) {
                  const start = dates.startOf(eventFields.start, 'day')
                  const end = dates.endOf(eventFields.start, 'day')

                  updatedFields = {
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

                  updatedFields = {
                    ...eventFields,
                    allDay: isAllDay,
                    start,
                    end,
                    startDay: null,
                    endDay: null,
                  }
                }

                setEventFields(updatedFields)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getUpdatedEvent(props.event, updatedFields),
                })
              }}
            >
              All Day
            </Checkbox>
          </Flex>

          <div className="mt-2 is-flex is-align-items-center">
            <Box mr="2">
              <FiCalendar size={'1.2em'} />
            </Box>
            <SelectCalendar
              defaultCalendarId={eventFields.calendarId}
              calendarsById={calendarContext.calendarsById}
              onChange={(calendar) => {
                // Forces a color change without an API request.
                // TODO: Discard changes on close.
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

                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
            />
          </div>

          <div className="mt-2 is-flex is-align-items-top">
            <FiAlignLeft className="mr-2" size={'1.2em'} />
            <ContentEditable
              innerRef={contentEditableRef}
              className="cal-event-edit-description"
              html={eventFields.description}
              onChange={(e) => {}}
              onBlur={(e) => {
                const description = contentEditableRef.current?.innerHTML || ''
                setEventFields({
                  ...eventFields,
                  description: description,
                })
              }}
              style={{ minHeight: '3em' }}
            />
          </div>

          <Flex mt="4" mb="2" justifyContent="space-between" alignItems="center">
            <Flex>
              <Button
                size="sm"
                borderRadius="sm"
                fontWeight="normal"
                colorScheme="primary"
                onClick={() =>
                  props.eventService.saveEvent(getUpdatedEvent(props.event, eventFields))
                }
              >
                Save
              </Button>

              {isExistingEvent ? (
                renderDeleteEventButton()
              ) : (
                <Button
                  ml="2"
                  size="sm"
                  borderRadius="sm"
                  fontWeight="normal"
                  onClick={() => eventActions.eventDispatch({ type: 'CANCEL_SELECT' })}
                >
                  Discard
                </Button>
              )}
            </Flex>

            <Button
              mt="2"
              mb="1"
              size="sm"
              fontWeight="normal"
              variant="ghost"
              onClick={() => {
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getUpdatedEvent(props.event, eventFields),
                })
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_MODE',
                  payload: {
                    editMode: 'FULL_EDIT',
                    editRecurringAction: 'SINGLE' as EditRecurringAction,
                  },
                })
              }}
            >
              More Options
            </Button>
          </Flex>
        </div>
      </>
    )
  }
}

export default EventPopover
