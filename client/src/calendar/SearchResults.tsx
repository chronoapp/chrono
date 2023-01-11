import React from 'react'
import { useRecoilValue } from 'recoil'

import { Flex, Box, Text, Center, Tooltip } from '@chakra-ui/react'
import { Portal, Popover, PopoverTrigger, PopoverContent, PopoverArrow } from '@chakra-ui/react'
import { FiRepeat } from 'react-icons/fi'

import { calendarWithDefault } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { editingEventState } from '@/state/EventsState'

import EventPopover from '@/calendar/event-edit/EventEditPopover'
import { sortEvents } from '@/calendar/utils/eventLevels'

import { format, timeRangeFormat } from '@/util/localizer'
import { LabelTag } from '@/components/LabelTag'
import Event from '@/models/Event'
import { EventService } from './event-edit/useEventService'
import * as API from '@/util/Api'

interface IProps {
  searchQuery: string
  events: Event[]
  eventService: EventService
}

function EventItem(props: { event: Event; eventService: EventService }) {
  const eventActions = useEventActions()
  const calendar = useRecoilValue(calendarWithDefault(props.event.calendar_id))
  const editingEvent = useRecoilValue(editingEventState)

  const dateDisplay = format(props.event.start, 'D MMM YYYY, ddd')
  const isEditing = editingEvent?.id === props.event.id && editingEvent?.editMode !== 'FULL_EDIT'

  function onSelectEvent() {
    eventActions.initEditEvent(props.event)
  }

  function renderEvent() {
    return (
      <Flex
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
            <Text fontSize="xs">{timeRangeFormat(props.event.start, props.event.end)}</Text>
            {props.event.recurring_event_id && (
              <Box ml="2">
                <FiRepeat size={'0.8em'} />
              </Box>
            )}
          </Flex>
        </Flex>
      </Flex>
    )
  }

  if (isEditing) {
    return (
      <Popover isOpen={true}>
        <PopoverTrigger>{renderEvent()}</PopoverTrigger>
        <Portal>
          <PopoverContent w="25em">
            <PopoverArrow />
            <EventPopover event={props.event} eventService={props.eventService} />
          </PopoverContent>
        </Portal>
      </Popover>
    )
  } else {
    return renderEvent()
  }
}

export default function SearchResults(props: IProps) {
  const [events, setEvents] = React.useState<Event[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)

  React.useEffect(() => {
    searchEvents()
  }, [props.searchQuery])

  async function searchEvents() {
    setLoading(true)
    const events = await API.searchEvents(props.searchQuery)
    setEvents(events)
    setLoading(false)
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
        {sortedEvents.map((event, idx, arr) => (
          <EventItem key={idx} event={event} eventService={props.eventService} />
        ))}
      </Box>
    )
  }
}
