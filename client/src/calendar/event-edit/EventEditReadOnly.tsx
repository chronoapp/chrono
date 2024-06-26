import { Box, Flex, Button, Text, Divider, IconButton } from '@chakra-ui/react'

import { FiCalendar, FiClock, FiAlignLeft, FiTrash, FiMail, FiMapPin, FiBell } from 'react-icons/fi'
import { MdClose } from 'react-icons/md'
import linkifyHtml from 'linkifyjs/html'

import { ZonedDateTime as DateTime, ChronoUnit } from '@js-joda/core'
import {
  formatDayMonth,
  formatTimeShort,
  formatTimeRangeDays,
  formatDuration,
} from '@/util/localizer-joda'
import * as dates from '@/util/dates-joda'

import { LabelTag } from '@/components/LabelTag'
import Calendar from '@/models/Calendar'
import Event from '@/models/Event'
import EventParticipant, { ResponseStatus } from '@/models/EventParticipant'

import EventFields from './EventFields'
import ParticipantList from './ParticipantList'
import EventResponseToggle from './EventResponseToggle'
import ConferenceList from './ConferenceList'
import { LocationReadOnly } from './LocationInput'
import SelectReminders from './SelectReminders'

interface IProps {
  event: Event
  selectedCalendar: Calendar
  eventFields: EventFields
  participants: EventParticipant[]
  myself: EventParticipant | undefined
  onDeleteEvent: () => void
  onClickEdit: () => void
  onClose: () => void
  onUpdateResponse: (response: ResponseStatus) => void
}

export default function EventEditReadOnly(props: IProps) {
  const {
    selectedCalendar,
    event,
    myself,
    eventFields,
    participants,
    onDeleteEvent,
    onClickEdit,
    onClose,
    onUpdateResponse,
  } = props

  const showReminder =
    (!props.eventFields.useDefaultReminders && eventFields.reminders.length > 0) ||
    (props.eventFields.useDefaultReminders && selectedCalendar.reminders.length > 0)

  const eventDuration = getDurationText(event.all_day, event.start, event.end)

  return (
    <Box mt="1" pl="4">
      <Box className="cal-event-modal-header" mt="1">
        {selectedCalendar.isWritable() && (
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
          onClick={onClose}
        ></IconButton>
      </Box>

      <Flex direction={'column'} mb="3" className="cal-event-modal">
        <Text fontSize={'md'} color="gray.900">
          {event.title_short}
        </Text>

        {event.labels && (
          <Flex>
            {event.labels.map((label) => (
              <LabelTag key={label.id} label={label} />
            ))}
          </Flex>
        )}

        <Flex mt="2" alignItems={'center'}>
          <Box mr="2" color="gray.600">
            <FiClock />
          </Box>
          <Text fontSize={'sm'}>{getDateDisplayText(event.all_day, event.start, event.end)}</Text>
          {eventDuration && (
            <Text fontSize="xs" color="gray.500" pl="1">
              {eventDuration}
            </Text>
          )}
        </Flex>

        <ConferenceList event={event} conferenceData={eventFields.conferenceData} readonly={true} />

        {showReminder && (
          <Flex mt="2" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiBell size="1em" />
            </Box>
            <SelectReminders
              useDefaultReminders={eventFields.useDefaultReminders}
              defaultReminders={selectedCalendar.reminders}
              reminders={eventFields.reminders}
              readonly={true}
            />
          </Flex>
        )}

        {eventFields.location && (
          <Flex mt="2" alignItems={'center'}>
            <Box mr="2" color="gray.600">
              <FiMapPin size="1em" />
            </Box>

            <LocationReadOnly location={eventFields.location} />
          </Flex>
        )}

        <Flex mt="2" alignItems={'center'}>
          <Box mr="2" color="gray.600">
            <FiCalendar />
          </Box>
          <Text fontSize={'sm'}>{selectedCalendar.summary}</Text>
        </Flex>

        {participants.length > 0 && (
          <Flex justifyContent="left" mt="2">
            <Flex mt="4" mr="2">
              <FiMail />
            </Flex>
            <Box w="100%">
              <ParticipantList
                readonly={true}
                organizer={eventFields.organizer}
                calendar={selectedCalendar}
                participants={participants}
              />
            </Box>
          </Flex>
        )}

        {event.description && (
          <Flex mt="2" alignItems={'flex-start'}>
            <Box flexShrink={0} mr="2">
              <FiAlignLeft />
            </Box>
            <Box
              fontSize={'sm'}
              maxW="100%"
              maxHeight={'25em'}
              overflowY="auto"
              pr="4"
              dangerouslySetInnerHTML={{ __html: linkifyHtml(event.description) }}
            ></Box>
          </Flex>
        )}
      </Flex>

      {selectedCalendar.isWritable() && (
        <>
          <Divider></Divider>
          <Flex mt="2" mb="2" ml="4" mr="4" alignItems="center">
            {myself && (
              <EventResponseToggle
                initialStatus={myself.response_status || 'needsAction'}
                onUpdateResponseStatus={onUpdateResponse}
              />
            )}

            <Button
              variant="outline"
              size="sm"
              fontWeight="normal"
              marginLeft="auto"
              onClick={onClickEdit}
            >
              Edit
            </Button>
          </Flex>
        </>
      )}
    </Box>
  )
}

function getDateDisplayText(isAllDay: boolean, start: DateTime, end: DateTime) {
  if (isAllDay) {
    const days = dates.diff(end, start, ChronoUnit.DAYS)
    if (days > 1) {
      return formatTimeRangeDays(start, dates.subtract(end, 1, ChronoUnit.DAYS))
    } else {
      return formatDayMonth(start)
    }
  } else {
    return `${formatDayMonth(start)} · ${formatTimeShort(start)} - ${formatTimeShort(end)}`
  }
}

function getDurationText(isAllDay: boolean, start: DateTime, end: DateTime) {
  if (isAllDay) {
    const numDays = dates.diff(end, start, ChronoUnit.DAYS)

    if (numDays > 1) {
      return `${dates.diff(end, start, ChronoUnit.DAYS)} days`
    } else {
      return null
    }
  } else {
    return formatDuration(dates.diff(end, start, ChronoUnit.MINUTES))
  }
}
