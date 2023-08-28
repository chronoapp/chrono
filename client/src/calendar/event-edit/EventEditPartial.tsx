import { createRef, useEffect } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import produce from 'immer'
import moment from 'moment'

import {
  Box,
  Flex,
  Button,
  Input,
  Checkbox,
  Menu,
  MenuButton,
  MenuList,
  IconButton,
} from '@chakra-ui/react'

import {
  FiCalendar,
  FiClock,
  FiAlignLeft,
  FiMail,
  FiMapPin,
  FiX,
  FiPlus,
  FiVideo,
} from 'react-icons/fi'

import ContentEditable from '@/lib/ContentEditable'
import { addNewLabels } from '@/calendar/utils/LabelUtils'
import { format, fullDayFormat } from '@/util/localizer'
import * as dates from '@/util/dates'

import { EventActionsType } from '@/state/useEventActions'
import { labelsState } from '@/state/LabelsState'
import { displayState } from '@/state/EventsState'
import { calendarsState } from '@/state/CalendarState'

import { LabelTag } from '@/components/LabelTag'
import LabelTree from '@/components/LabelTree'

import Calendar from '@/models/Calendar'
import Event from '@/models/Event'
import { Label } from '@/models/Label'
import EventParticipant from '@/models/EventParticipant'
import Contact from '@/models/Contact'

import EventFields from './EventFields'
import ParticipantList from './ParticipantList'
import ConferenceList from './ConferenceList'
import { mergeParticipants } from './EventEditUtils'
import TimeRangeSelect from './TimeRangeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import SelectCalendar from './SelectCalendar'
import TaggableInput from './TaggableInput'
import { LocationInput, LocationReadOnly } from './LocationInput'
import EventEditReadOnly from './EventEditReadOnly'

interface IProps {
  event: Event
  eventFields: EventFields
  eventActions: EventActionsType
  selectedCalendar: Calendar
  participants: EventParticipant[]
  getUpdatedEvent: (
    event: Event,
    eventFields: EventFields,
    participants: EventParticipant[]
  ) => Event
  setEventFields: (eventFields: EventFields) => void
  setParticipants: (participants: EventParticipant[]) => void
  onSaveEvent: (event: Event) => void
}

export default function EventEditPartial(props: IProps) {
  const {
    eventActions,
    eventFields,
    selectedCalendar,
    participants,
    getUpdatedEvent,
    setEventFields,
    setParticipants,
  } = props

  const setDisplay = useSetRecoilState(displayState)
  const contentEditableRef = createRef<HTMLInputElement>()
  const labelState = useRecoilValue(labelsState)
  const labels: Label[] = Object.values(labelState.labelsById)
  const calendarsById = useRecoilValue(calendarsState).calendarsById

  const defaultDays = eventFields.allDay
    ? Math.max(dates.diff(eventFields.end, eventFields.start, 'day'), 1)
    : 1

  useEffect(() => {
    document.addEventListener('keydown', keyboardEvents)
    return function cleanup() {
      document.removeEventListener('keydown', keyboardEvents)
    }
  }, [props.eventFields])

  function keyboardEvents(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
        props.onSaveEvent(getUpdatedEvent(props.event, eventFields, participants))
      }
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
          icon={<FiX />}
          onClick={eventActions.cancelSelect}
        ></IconButton>
      </Box>

      <Flex
        mt="1"
        pl="4"
        pr="4"
        maxHeight={'35em'}
        overflowX="hidden"
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
            eventActions.updateEditingEvent(getUpdatedEvent(props.event, eventFields, participants))
          }}
          handleChange={(title, labelIds: string[]) => {
            const updatedLabels = addNewLabels(labelState.labelsById, eventFields.labels, labelIds)
            setEventFields({ ...eventFields, title, labels: updatedLabels })
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
          <Box color="gray.600" mr="2" mt="2">
            <FiMail size="1em" />
          </Box>

          <Box w="100%">
            <ParticipantList
              readonly={false}
              organizer={eventFields.organizer}
              calendar={selectedCalendar}
              participants={participants}
              onUpdateParticipants={(updatedParticipants) => setParticipants(updatedParticipants)}
              maxRecommendations={2}
            />
          </Box>
        </Flex>

        <Flex mt="2" alignItems={'center'}>
          <Box mr="2" color="gray.600">
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

        <Flex mt="2" alignItems={'center'}>
          <Box mr="2" color="gray.600">
            <FiMapPin size="1em" />
          </Box>

          <LocationInput
            location={eventFields.location || ''}
            onUpdateLocation={(location) => {
              setEventFields({ ...eventFields, location: location })
            }}
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
      </Flex>

      <Flex mt="4" mb="2" ml="4" mr="4" justifyContent="space-between" alignItems="center">
        <Flex>
          <Button
            size="sm"
            colorScheme="primary"
            onClick={() =>
              props.onSaveEvent({
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
    </>
  )
}