import React from 'react'
import ReactDOM from 'react-dom'

import { useRecoilValue } from 'recoil'
import { usePopper } from 'react-popper'

import { Flex, Box, Text, Center, Tooltip } from '@chakra-ui/react'
import { FiRepeat } from 'react-icons/fi'

import { calendarWithDefault } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { editingEventState } from '@/state/EventsState'

import EventPopover from '@/calendar/event-edit/EventEditPopover'
import { sortEvents } from '@/calendar/utils/eventLevels'

import { formatDayMonthYearWeekday, formatTimeRange } from '@/util/localizer-joda'
import { LabelTag } from '@/components/LabelTag'
import Event from '@/models/Event'

import { EventService } from './event-edit/useEventService'
import * as API from '@/util/Api'

interface IProps {
  searchQuery: string
  events: Event[]
  eventService: EventService
}

/**
 * Search events.
 *
 * TODO:
 * 1) Group events by day and scroll to the current day
 * 2) Update events when event has been updated here.
 *
 */
export default function SearchResults(props: IProps) {
  const [events, setEvents] = React.useState<Event[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)

  // Selected Event state
  const editingEvent = useRecoilValue(editingEventState)
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null)
  const [referenceElement, setReferenceElement] = React.useState<HTMLDivElement | null>(null)
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'auto',
  })

  React.useEffect(() => {
    if (props.searchQuery) {
      searchEvents(props.searchQuery)
    }
  }, [props.searchQuery])

  async function searchEvents(searchQuery: string) {
    setLoading(true)
    const events = await API.searchEvents(searchQuery)
    setEvents(events)
    setLoading(false)
  }

  function renderSelectedEventPopover() {
    if (editingEvent?.event && referenceElement) {
      return ReactDOM.createPortal(
        <Box
          ref={(node) => setPopperElement(node)}
          style={styles.popper}
          {...attributes.popper}
          bg="white"
          width="xs"
          maxH="3xl"
          zIndex={10}
          border="0.5px solid rgba(82, 82, 100, 0.3)"
          borderRadius="md"
        >
          <EventPopover event={editingEvent?.event} eventService={props.eventService} />
        </Box>,
        document.body
      )
    }
  }

  if (loading) {
    return (
      <Center w="100%" h="5em" overflow="auto">
        <Text color="gray.500">Searching..</Text>
      </Center>
    )
  }

  const sortedEvents = events.sort((a, b) => -sortEvents(a, b))
  if (sortedEvents.length === 0) {
    return (
      <Center w="100%" h="5em" overflow="auto">
        <Text color="gray.500">We couldn't find anything</Text>
      </Center>
    )
  } else {
    return (
      <Box w="100%" height="calc(100vh - 3.25rem)" overflow="auto">
        {sortedEvents.map((event, idx, arr) => {
          const showEditingPopover =
            editingEvent?.id === event.id &&
            editingEvent?.event?.calendar_id === event.calendar_id &&
            (editingEvent?.editMode == 'READ' || editingEvent?.editMode == 'EDIT')

          return (
            <EventItem
              key={idx}
              event={event}
              eventService={props.eventService}
              ref={showEditingPopover ? (node) => setReferenceElement(node) : undefined}
            />
          )
        })}

        {renderSelectedEventPopover()}
      </Box>
    )
  }
}

interface EventItemProps {
  event: Event
  eventService: EventService
}

const EventItem = React.forwardRef<HTMLDivElement, EventItemProps>((props, ref) => {
  const eventActions = useEventActions()
  const calendar = useRecoilValue(calendarWithDefault(props.event.calendar_id))
  const dateDisplay = formatDayMonthYearWeekday(props.event.start)

  function onSelectEvent() {
    eventActions.initEditEvent(props.event)
  }

  return (
    <Flex
      ref={ref}
      alignItems={'center'}
      borderBottom="1px solid"
      borderColor={'gray.200'}
      pl="5"
      pt="1"
      pb="1"
      _hover={{
        background: 'gray.100',
        cursor: 'pointer',
      }}
      onClick={onSelectEvent}
    >
      <Box w="8em" flexShrink={0}>
        <Text fontSize="sm" align="left">
          {dateDisplay}
        </Text>
      </Box>
      <Flex direction={'column'}>
        <Flex alignItems={'center'}>
          <Tooltip label={calendar.summary}>
            <Box
              pl="1"
              bgColor={calendar.backgroundColor}
              w="1em"
              h="1em"
              borderRadius={'5'}
              flexShrink={0}
            ></Box>
          </Tooltip>
          <Text pl="2" fontSize="sm" textAlign={'left'}>
            {props.event.title_short}
          </Text>
          <Flex pl="2" alignItems={'center'}>
            {props.event.labels.map((label) => {
              return <LabelTag key={`${props.event.id}-${label.id}`} label={label} />
            })}
          </Flex>
        </Flex>
        <Flex alignItems={'center'}>
          <Text fontSize="xs">{formatTimeRange(props.event.start, props.event.end)}</Text>
          {props.event.recurring_event_id && (
            <Box ml="2">
              <FiRepeat size={'0.8em'} />
            </Box>
          )}
        </Flex>
      </Flex>
    </Flex>
  )
})
