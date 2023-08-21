import React, { useState, useEffect, createRef } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'

import {
  Box,
  Flex,
  Button,
  Input,
  Checkbox,
  Menu,
  MenuButton,
  MenuList,
  Text,
  Divider,
  useToast,
  IconButton,
} from '@chakra-ui/react'

import { FiCalendar, FiClock, FiAlignLeft, FiTrash, FiPlus, FiMail, FiVideo } from 'react-icons/fi'
import produce from 'immer'
import moment from 'moment'
import linkifyHtml from 'linkifyjs/html'

import * as dates from '@/util/dates'
import { MdClose } from 'react-icons/md'

import { format, fullDayFormat, formatDuration } from '@/util/localizer'
import { addNewLabels } from '@/calendar/utils/LabelUtils'

import Event from '@/models/Event'
import Calendar from '@/models/Calendar'
import EventParticipant from '@/models/EventParticipant'
import { Label } from '@/models/Label'
import Contact from '@/models/Contact'

import { LabelTag } from '@/components/LabelTag'
import LabelTree from '@/components/LabelTree'
import { InfoAlert } from '@/components/Alert'

import { labelsState } from '@/state/LabelsState'
import { calendarsState, primaryCalendarSelector } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { displayState, editingEventState } from '@/state/EventsState'
import { userState } from '@/state/UserState'
import ContentEditable from '@/lib/ContentEditable'

import { mergeParticipants } from './EventEditUtils'
import TimeRangeSelect from './TimeRangeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import SelectCalendar from './SelectCalendar'
import TaggableInput from './TaggableInput'
import { EventService } from './useEventService'
import EventFields from './EventFields'
import ParticipantList from './ParticipantList'
import EventResponseToggle from './EventResponseToggle'
import ConferenceList from './ConferenceList'
interface IProps {
  event: Event
  eventService: EventService
}

function EventPopover(props: IProps) {
  const eventActions = useEventActions()
  const editingEvent = useRecoilValue(editingEventState)
  const setDisplay = useSetRecoilState(displayState)
  const toast = useToast()

  const labelState = useRecoilValue(labelsState)
  const calendarsById = useRecoilValue(calendarsState).calendarsById
  const primaryCalendar = useRecoilValue(primaryCalendarSelector)
  const selectedCalendar = getSelectedCalendar(props.event.calendar_id)

  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      selectedCalendar?.id,
      props.event.all_day,
      props.event.start_day,
      props.event.end_day,
      props.event.organizer,
      props.event.recurrences ? props.event.recurrences.join('\n') : null,
      props.event.guests_can_modify,
      props.event.guests_can_invite_others,
      props.event.guests_can_see_other_guests,
      props.event.conference_data
    )
  )
  const [participants, setParticipants] = useState<EventParticipant[]>(props.event.participants)
  const thisUser = useRecoilValue(userState)

  const myself = participants.find(
    (p) => p.email === thisUser?.email || p.email === selectedCalendar.email
  )

  const defaultDays = eventFields.allDay
    ? Math.max(dates.diff(eventFields.end, eventFields.start, 'day'), 1)
    : 1

  const contentEditableRef = createRef<HTMLInputElement>()

  useEffect(() => {
    document.addEventListener('keydown', keyboardEvents)
    return function cleanup() {
      document.removeEventListener('keydown', keyboardEvents)
    }
  }, [eventFields])

  const isReadOnly = editingEvent?.editMode == 'READ'

  return <Box boxShadow="xl">{isReadOnly ? renderReadOnlyView() : renderEditView()}</Box>

  function keyboardEvents(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
        props.eventService.saveEvent(getUpdatedEvent(props.event, eventFields, participants))
      }
    }
  }

  function getUpdatedEvent(
    e: Event,
    fields: EventFields,
    eventParticipants: EventParticipant[]
  ): Event {
    return {
      ...e,
      ...EventFields.getMutableEventFields(fields),
      participants: eventParticipants,
    }
  }

  function onDeleteEvent() {
    if (props.event.recurring_event_id) {
      eventActions.showConfirmDialog('DELETE_RECURRING_EVENT', props.event)
    } else {
      props.eventService.deleteEvent(props.event.calendar_id, props.event.id)
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

  function renderAddTagDropdown() {
    return (
      <Menu isLazy>
        {({ onClose }) => (
          <>
            <MenuButton
              mb="2"
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
      <Box mt="1" pl="4">
        <Box className="cal-event-modal-header" mt="1">
          {calendar.isWritable() && (
            <IconButton
              variant="ghost"
              aria-label="delete event"
              size="sm"
              icon={<FiTrash />}
              onClick={onDeleteEvent}
            />
          )}

          <IconButton
            variant="ghost"
            ml="1"
            mr="1"
            size="sm"
            aria-label="close modal"
            color="gray.600"
            icon={<MdClose />}
            onClick={eventActions.cancelSelect}
          ></IconButton>
        </Box>

        <Flex direction={'column'} mb="3" className="cal-event-modal">
          <Text fontSize={'md'} color="gray.900">
            {props.event.title_short}
          </Text>

          {props.event.labels && (
            <Flex>
              {props.event.labels.map((label) => (
                <LabelTag key={label.id} label={label} />
              ))}
            </Flex>
          )}

          <Flex mt="2" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiClock />
            </Box>
            <Text fontSize={'sm'}>
              {format(eventFields.start, 'YYYY-MM-DD')} {format(eventFields.start, 'hh:mm')} -{' '}
              {format(eventFields.end, 'hh:mm')}
              {format(eventFields.end, 'A')}
            </Text>
            {!props.event.all_day && (
              <Text fontSize="xs" color="gray.500" pl="1">
                {formatDuration(dates.diff(eventFields.end, eventFields.start, 'minutes'))}
              </Text>
            )}
          </Flex>

          <ConferenceList
            mb="1"
            originalConferenceData={props.event.conference_data}
            conferenceData={eventFields.conferenceData}
            readonly={true}
          />

          <Flex mt="2" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiCalendar />
            </Box>
            <Text fontSize={'sm'}>{calendar.summary}</Text>
          </Flex>

          {participants.length > 0 && (
            <Flex justifyContent="left" mt="2">
              <Flex mt="4" mr="2">
                <FiMail />
              </Flex>
              <Box w="100%">
                <ParticipantList
                  readonly={true}
                  calendar={getSelectedCalendar(eventFields.calendarId)}
                  participants={participants}
                  onUpdateParticipants={(updatedParticipants) =>
                    setParticipants(updatedParticipants)
                  }
                />
              </Box>
            </Flex>
          )}

          {props.event.description && (
            <Flex mt="2" alignItems={'flex-start'}>
              <FiAlignLeft className="mr-2 is-flex-shrink-0" />
              <Box
                fontSize={'sm'}
                maxW="100%"
                maxHeight={'25em'}
                overflowY="auto"
                pr="4"
                dangerouslySetInnerHTML={{ __html: linkifyHtml(props.event.description) }}
              ></Box>
            </Flex>
          )}
        </Flex>

        {calendar.isWritable() && (
          <>
            <Divider></Divider>
            <Flex mt="2" mb="3" ml="4" mr="4" alignItems="center">
              {myself && (
                <EventResponseToggle
                  initialStatus={myself.response_status || 'needsAction'}
                  onUpdateResponseStatus={(responseStatus) => {
                    const updatedParticipants = produce(participants, (draft) => {
                      const me = draft.find((p) => p.email === myself.email)
                      if (me) {
                        me.response_status = responseStatus
                      }
                    })
                    setParticipants(updatedParticipants)

                    let responseText = ''
                    if (responseStatus === 'accepted') {
                      responseText = 'Accepted'
                    } else if (responseStatus === 'declined') {
                      responseText = 'Declined'
                    } else if (responseStatus === 'tentative') {
                      responseText = 'Tentatively accepted'
                    }

                    const updatedEvent = getUpdatedEvent(
                      props.event,
                      eventFields,
                      updatedParticipants
                    )
                    eventActions.updateEditingEvent(updatedEvent)
                    props.eventService.saveEvent(updatedEvent, false, false)

                    if (responseText) {
                      toast({
                        render: (p) => {
                          return (
                            <InfoAlert
                              onClose={p.onClose}
                              title={`${responseText} invite to ${props.event.title_short}`}
                            />
                          )
                        },
                      })
                    }
                  }}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                fontWeight="normal"
                marginLeft="auto"
                onClick={() => {
                  eventActions.updateEditingEvent(
                    getUpdatedEvent(props.event, eventFields, participants)
                  )
                  eventActions.updateEditMode('FULL_EDIT', 'SINGLE')
                }}
              >
                Edit
              </Button>
            </Flex>
          </>
        )}
      </Box>
    )
  }

  function renderEditView() {
    const labels: Label[] = Object.values(labelState.labelsById)

    return (
      <>
        <Box className="cal-event-modal-header" mt="1">
          <IconButton
            variant="ghost"
            ml="2"
            mr="2"
            size="sm"
            aria-label="close modal"
            color="gray.600"
            icon={<MdClose />}
            onClick={eventActions.cancelSelect}
          ></IconButton>
        </Box>

        <Flex
          mt="1"
          pl="4"
          pr="4"
          maxHeight={'35em'}
          overflowX="hidden"
          overflowY="auto"
          direction={'column'}
          fontSize="sm"
        >
          <TaggableInput
            labels={labels}
            placeholder={'Event title'}
            title={eventFields.title}
            portalCls={'.cal-event-modal-container'}
            isHeading={false}
            onBlur={() => {
              eventActions.updateEditingEvent(
                getUpdatedEvent(props.event, eventFields, participants)
              )
            }}
            handleChange={(title, labelIds: string[]) => {
              const updatedLabels = addNewLabels(
                labelState.labelsById,
                eventFields.labels,
                labelIds
              )
              setEventFields({ ...eventFields, title, labels: updatedLabels })
            }}
            onUpdateContacts={(contacts: Contact[]) => {
              const updatedParticipants = mergeParticipants(
                getSelectedCalendar(eventFields.calendarId),
                participants,
                contacts.map((c) => EventParticipant.fromContact(c))
              )
              setParticipants(updatedParticipants)
            }}
          />

          <Flex mt="0.5" alignItems="center" flexWrap="wrap" justifyContent="left">
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

          <Flex mt="1" alignItems="top">
            <Box mt="2.5" mr="2" color="gray.600">
              <FiClock />
            </Box>

            <Flex direction="column">
              <Input
                type="date"
                size="sm"
                width="fit-content"
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
                  setDisplay((prevState) => {
                    return { ...prevState, selectedDate: start }
                  })
                  eventActions.updateEditingEvent(
                    getUpdatedEvent(props.event, updatedFields, participants)
                  )
                }}
              />

              <Flex mt="1">
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
                      eventActions.updateEditingEvent(
                        getUpdatedEvent(props.event, updatedEventFields, participants)
                      )
                    }}
                  />
                )}
                {!eventFields.allDay && (
                  <TimeRangeSelect
                    start={eventFields.start}
                    end={eventFields.end}
                    onSelectStartDate={(date) => {
                      setEventFields({ ...eventFields, start: date })

                      eventActions.updateEditingEvent({ ...props.event, start: date })
                    }}
                    onSelectEndDate={(date) => {
                      setEventFields({ ...eventFields, end: date })
                      eventActions.updateEditingEvent({ ...props.event, end: date })
                    }}
                  />
                )}

                <Checkbox
                  ml="1"
                  size="sm"
                  isChecked={eventFields.allDay}
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
                    eventActions.updateEditingEvent(
                      getUpdatedEvent(props.event, updatedFields, participants)
                    )
                  }}
                >
                  All Day
                </Checkbox>
              </Flex>
            </Flex>
          </Flex>

          <Flex mt="2" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiCalendar size="1em" />
            </Box>
            <SelectCalendar
              defaultCalendarId={eventFields.calendarId}
              calendarsById={calendarsById}
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

                eventActions.updateEditingEvent(updatedEvent)
              }}
            />
          </Flex>

          <Flex mt="2" alignItems={'top'}>
            <Box color="gray.600" mr="2" mt="1">
              <FiMail size="1em" />
            </Box>
            <Box w="100%">
              <ParticipantList
                readonly={false}
                calendar={getSelectedCalendar(eventFields.calendarId)}
                participants={participants}
                onUpdateParticipants={(updatedParticipants) => setParticipants(updatedParticipants)}
                maxRecommendations={2}
              />
            </Box>
          </Flex>

          <Flex mt="2">
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

          <Flex mt="2" alignItems={'top'}>
            <Box color="gray.700" mr="2" mt="1">
              <FiAlignLeft />
            </Box>
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
          </Flex>

          <Flex mt="4" mb="2" justifyContent="space-between" alignItems="center">
            <Flex>
              <Button
                size="sm"
                colorScheme="primary"
                onClick={() =>
                  props.eventService.saveEvent({
                    ...getUpdatedEvent(props.event, eventFields, participants),
                    conference_data: eventFields.conferenceData,
                  })
                }
              >
                Save
              </Button>

              <Button
                ml="2"
                size="sm"
                variant="ghost"
                fontWeight="normal"
                onClick={eventActions.cancelSelect}
              >
                Cancel
              </Button>
            </Flex>

            <Button
              mt="2"
              mb="1"
              size="sm"
              fontWeight="normal"
              variant="ghost"
              onClick={() => {
                eventActions.updateEditingEvent({
                  ...getUpdatedEvent(props.event, eventFields, participants),
                  conference_data: eventFields.conferenceData,
                })
                eventActions.updateEditMode('FULL_EDIT', 'SINGLE')
              }}
            >
              More Options
            </Button>
          </Flex>
        </Flex>
      </>
    )
  }
}

export default EventPopover
