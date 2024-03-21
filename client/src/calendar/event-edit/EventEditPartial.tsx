import { createRef, useEffect, useRef } from 'react'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import produce from 'immer'

import { Box, Flex, Button, Input, Checkbox, IconButton } from '@chakra-ui/react'
import { FiCalendar, FiClock, FiAlignLeft, FiMail, FiMapPin, FiX, FiVideo } from 'react-icons/fi'

import ContentEditable from '@/lib/ContentEditable'
import { addNewLabels } from '@/calendar/utils/LabelUtils'
import { formatFullDay, yearStringToDate } from '@/util/localizer-luxon'
import * as dates from '@/util/dates-luxon'

import { labelsState } from '@/state/LabelsState'
import { displayState } from '@/state/EventsState'
import { calendarsState } from '@/state/CalendarState'
import { userState } from '@/state/UserState'

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
import TagDropdown from './TagAddDropdown'
import { LocationInput } from './LocationInput'

interface IProps {
  event: Event
  eventFields: EventFields
  selectedCalendar: Calendar
  participants: EventParticipant[]
  setEventFields: (eventFields: EventFields) => void
  setParticipants: (participants: EventParticipant[]) => void
  onSaveEvent: () => void
  onClickMoreOptions: () => void
  onCancel: () => void
}

/**
 * This is the smaller event editor that shows up after a click or drag&drop
 * to create a new event.
 */
export default function EventEditPartial(props: IProps) {
  const { eventFields, selectedCalendar, participants, setEventFields, setParticipants } = props

  const setDisplay = useSetRecoilState(displayState)
  const contentEditableRef = createRef<HTMLInputElement>()
  const labelState = useRecoilValue(labelsState)
  const labels: Label[] = Object.values(labelState.labelsById)
  const user = useRecoilValue(userState)

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
        props.onSaveEvent()
      }
    }
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
          onClick={props.onCancel}
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
          <TagDropdown eventFields={eventFields} setEventFields={setEventFields} />
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
              value={formatFullDay(eventFields.start)}
              onChange={(e) => {
                const duration = dates.diff(eventFields.end, eventFields.start, 'minutes')
                const start = dates.merge(yearStringToDate(e.target.value), eventFields.start)
                const end = dates.add(start, duration, 'minute')

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
                setDisplay((prevState) => {
                  return { ...prevState, selectedDate: start }
                })
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
                      endDay: formatFullDay(endDate),
                    }
                    setEventFields(updatedEventFields)
                  }}
                />
              )}
              {!eventFields.allDay && (
                <TimeRangeSelect
                  start={eventFields.start}
                  end={eventFields.end}
                  onSelectStartDate={(date) => {
                    setEventFields({ ...eventFields, start: date })
                  }}
                  onSelectEndDate={(date) => {
                    setEventFields({ ...eventFields, end: date })
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
                      startDay: formatFullDay(start),
                      endDay: formatFullDay(end),
                    }
                  } else {
                    const start = dates.startOf(eventFields.start, 'day')
                    const end = dates.add(start, 1, 'hour')

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
            accounts={user?.accounts || []}
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
            event={props.event}
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
          <Button size="sm" colorScheme="primary" onClick={props.onSaveEvent}>
            Save
          </Button>

          <Button ml="2" size="sm" variant="ghost" fontWeight="normal" onClick={props.onCancel}>
            Cancel
          </Button>
        </Flex>

        <Button
          mt="2"
          mb="1"
          size="sm"
          fontWeight="normal"
          variant="ghost"
          onClick={props.onClickMoreOptions}
        >
          More Options
        </Button>
      </Flex>
    </>
  )
}
