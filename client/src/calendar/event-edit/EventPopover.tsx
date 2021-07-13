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
import { addNewLabels } from '../utils/LabelUtils'

import Event, { UNSAVED_EVENT_ID } from '@/models/Event'
import Calendar from '@/models/Calendar'
import { Label } from '@/models/Label'
import { EventActionContext } from '../EventActionContext'
import { CalendarsContext } from '@/contexts/CalendarsContext'
import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'
import { LabelTag } from '@/components/LabelTag'
import LabelTree from '@/components/LabelTree'

import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import SelectCalendar from './SelectCalendar'
import ContentEditable from '@/lib/ContentEditable'
import TaggableInput from './TaggableInput'
import useEventService from './useEventService'
import { getRecurrenceRules } from './RecurringEventEditor'

interface IProps {
  event: Event
}

/**
 * Editable fields in event.
 */
export class EventFields {
  public constructor(
    readonly title: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly labels: Label[],
    readonly calendarId: string,
    readonly allDay: boolean,
    readonly fullDays: number
  ) {}
}

function EventPopover(props: IProps) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const { saveEvent, updateEvent, deleteEvent } = useEventService()

  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      getSelectedCalendar(props.event.calendar_id)?.id,
      props.event.all_day,
      props.event.all_day ? dates.diff(props.event.end, props.event.start, 'day') : 0
    )
  )

  const isExistingEvent = props.event.id !== UNSAVED_EVENT_ID
  const contentEditableRef = createRef<HTMLInputElement>()
  const [confirmDeleteActive, setConfirmDeleteActive] = useState<boolean>(false)

  useEffect(() => {
    document.addEventListener('keydown', keyboardEvents)
    return function cleanup() {
      document.removeEventListener('keydown', keyboardEvents)
    }
  }, [eventFields])

  const isReadOnly = eventActions.eventState.editingEvent?.editMode == 'READ'
  return <Box boxShadow="2xl">{isReadOnly ? renderReadOnlyView() : renderEditView()}</Box>

  function setReadOnly(readOnly: boolean) {
    eventActions.eventDispatch({ type: 'UPDATE_EDIT_MODE', payload: readOnly ? 'READ' : 'EDIT' })
  }

  function keyboardEvents(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
        saveEvent(getUpdatedEvent(props.event, eventFields))
      }
    }
  }

  function getUpdatedEvent(e: Event, fields: EventFields) {
    const fullDayEventDetails = fields.allDay
      ? {
          all_day: true,
          start_day: fullDayFormat(fields.start),
          end_day: fullDayFormat(dates.add(fields.start, fields.fullDays, 'day')),
        }
      : {
          all_day: false,
          start: fields.start,
          end: fields.end,
          start_day: null,
          end_day: null,
        }

    const event = {
      ...e,
      title: fields.title,
      description: fields.description,
      calendar_id: fields.calendarId,
      labels: fields.labels,
      ...fullDayEventDetails,
    }

    return event
  }

  function onClickDeleteEvent() {
    if (props.event.recurring_event_id) {
      setConfirmDeleteActive(!confirmDeleteActive)
    } else {
      deleteEvent(props.event.id)
    }
  }

  function renderDeleteEventButton() {
    if (props.event.recurring_event_id) {
      return renderConfirmDeleteDropdown()
    } else {
      return (
        <Button
          ml="2"
          borderRadius="sm"
          size="sm"
          fontWeight="normal"
          leftIcon={<FiTrash />}
          onClick={onClickDeleteEvent}
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

        <div className="cal-event-modal is-flex is-flex-direction-column">
          <div className="has-text-grey-darker is-size-5">{eventFields.title}</div>

          {props.event.labels && (
            <div style={{ display: 'flex' }}>
              {props.event.labels.map((label) => (
                <LabelTag key={label.id} label={label} allowEdit={false} />
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
              <div dangerouslySetInnerHTML={{ __html: linkifyHtml(props.event.description) }}></div>
            </div>
          )}

          <div className="mt-2 is-flex is-align-items-center">
            <FiCalendar className="mr-2 is-flex-shrink-0" />
            <span>{calendar.summary}</span>
          </div>

          {calendar.isWritable() && (
            <div className="mt-4 is-flex">
              <Button
                size="sm"
                borderRadius="sm"
                fontWeight="normal"
                colorScheme="primary"
                onClick={(e) => {
                  eventActions.eventDispatch({ type: 'UPDATE_EDIT_MODE', payload: 'FULL_EDIT' })
                }}
              >
                Edit
              </Button>

              {renderDeleteEventButton()}
            </div>
          )}
        </div>
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
          />

          <Flex mt="2" alignItems="center" flexWrap="wrap" justifyContent="left">
            {eventFields.labels.map((label) => (
              <Box mb="1" key={label.id}>
                <LabelTag
                  label={label}
                  allowEdit={true}
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
              borderBottom="3px solid"
              borderBottomColor="gray.200"
              value={format(eventFields.start, 'YYYY-MM-DD')}
              onChange={(e) => {
                const m = moment(e.target.value, 'YYYY-MM-DD')
                const duration = dates.diff(eventFields.end, eventFields.start, 'minutes')

                const start = dates.merge(m.toDate(), eventFields.start)
                const end = dates.add(start, duration, 'minutes')
                const updatedFields = { ...eventFields, start, end }
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
                days={eventFields.fullDays}
                startDate={eventFields.start}
                onSelectNumDays={(days) => {
                  setEventFields({ ...eventFields, fullDays: days })
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
                const isAllDay = e.target.checked
                if (isAllDay) {
                  const start = dates.startOf(eventFields.start, 'day')
                  const end = dates.endOf(eventFields.start, 'day')
                  setEventFields({ ...eventFields, allDay: isAllDay, start, end, fullDays: 1 })
                } else {
                  const start = dates.startOf(eventFields.start, 'day')
                  const end = dates.add(start, 1, 'hours')
                  setEventFields({ ...eventFields, allDay: isAllDay, start, end })
                }
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
              onChange={(calendarId) => {
                // Forces a color change without an API request.
                // TODO: Discard changes on close.
                setEventFields({ ...eventFields, calendarId: calendarId })
                const event = { ...props.event, calendar_id: calendarId }
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: event,
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

          <Flex mt="4" justifyContent="space-between" alignItems="center">
            <Flex>
              <Button
                size="sm"
                borderRadius="sm"
                fontWeight="normal"
                colorScheme="primary"
                onClick={() => saveEvent(getUpdatedEvent(props.event, eventFields))}
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
                eventActions.eventDispatch({ type: 'UPDATE_EDIT_MODE', payload: 'FULL_EDIT' })
              }}
            >
              More Options
            </Button>
          </Flex>
        </div>
      </>
    )
  }

  function renderConfirmDeleteDropdown() {
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
          onClick={onClickDeleteEvent}
        >
          Delete
        </MenuButton>

        <MenuList mt="-2">
          <MenuItem fontSize="sm" onClick={() => deleteEvent(props.event.id)}>
            This event
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem fontSize="sm" onClick={() => deleteThisAndFollowingEvents(props.event)}>
            This and following events
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() => {
              props.event.recurring_event_id && deleteEvent(props.event.recurring_event_id, 'ALL')
            }}
          >
            All events
          </MenuItem>
        </MenuList>
      </Menu>
    )
  }

  async function deleteThisAndFollowingEvents(event: Event) {
    if (!event.recurrences || !event.recurring_event_id || !event.original_start) {
      throw Error('Invalid Recurring Event')
    }

    const recurrenceStr = event.recurrences!.join('\n')
    const ruleOptions = getRecurrenceRules(recurrenceStr, event.original_start)

    if (ruleOptions.count) {
      const upToThisEventRules = produce(ruleOptions, (draft) => {
        delete draft['count']
        draft.until = dates.subtract(event.start, 1, 'seconds')
        draft.dtstart = event.original_start
      })

      const upToThisRRule = new RRule(upToThisEventRules)
      const upToThisCount = upToThisRRule.all().length
      console.log(`New Count: ${upToThisCount}`)

      const upToThisRRuleNoStart = new RRule({ ...upToThisEventRules, dtstart: null })
      const updatedParentEvent = getParentEventWithRecurrence(
        event,
        upToThisRRuleNoStart.toString()
      )

      updateEvent(updatedParentEvent)
    } else if (ruleOptions.until) {
      const upToThisEventRules = produce(ruleOptions, (draft) => {
        delete draft['count']
        draft.until = dates.subtract(event.start, 1, 'seconds')
      })

      const recurrence = new RRule(upToThisEventRules).toString()
      const updatedParentEvent = getParentEventWithRecurrence(event, recurrence)

      updateEvent(updatedParentEvent)
    }
  }

  /**
   * Creates the base recurring event with the updated recurrence.
   */
  function getParentEventWithRecurrence(event: Event, recurrence: string) {
    if (!event.recurring_event_id) {
      throw new Error('Not a recurring event.')
    }

    return produce(event, (draft) => {
      draft.recurrences = [recurrence]
      draft.id = event.recurring_event_id!
      draft.recurring_event_id = null
      draft.start = event.original_start!
      draft.end = dates.add(
        event.original_start!,
        dates.diff(event.end, event.start, 'minutes'),
        'minutes'
      )
    })
  }
}

export default EventPopover
