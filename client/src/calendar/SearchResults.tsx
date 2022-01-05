import React from 'react'
import { Flex, Box, Text, Center } from '@chakra-ui/react'
import { Portal, Popover, PopoverTrigger, PopoverContent, PopoverArrow } from '@chakra-ui/react'

import { EventActionContext, EventActionContextType } from '@/calendar/EventActionContext'
import EventPopover from '@/calendar/event-edit/EventPopover'
import { sortEvents } from '@/calendar/utils/eventLevels'

import { CalendarsContext, CalendarsContextType } from '@/contexts/CalendarsContext'
import { format, timeRangeFormat } from '@/util/localizer'
import { LabelTag } from '@/components/LabelTag'
import Event from '@/models/Event'

interface IProps {
  search: string
  events: Event[]
}

function EventItem(props: { event: Event }) {
  const calendarContext = React.useContext<CalendarsContextType>(CalendarsContext)
  const eventActionContext = React.useContext<EventActionContextType>(EventActionContext)

  const dateDisplay = format(props.event.start, 'D MMM YYYY, ddd')
  const color = calendarContext.getCalendarColor(props.event.calendar_id)

  const editingEvent = eventActionContext.eventState.editingEvent
  const isEditing = editingEvent?.id === props.event.id && editingEvent?.editMode !== 'FULL_EDIT'

  function onSelectEvent() {
    eventActionContext?.eventDispatch({
      type: 'INIT_EDIT_EVENT',
      payload: { event: props.event },
    })
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
            <Box pl="1" bgColor={color} w="1em" h="1em" borderRadius={'5'} flexShrink={0}></Box>
            <Text pl="2" fontSize="sm" textAlign={'left'}>
              {props.event.title_short}
            </Text>
            <Flex pl="2" alignItems={'center'}>
              {props.event.labels.map((label) => {
                return <LabelTag key={`${props.event.id}-${label.id}`} label={label} />
              })}
            </Flex>
          </Flex>
          <Flex>
            <Text fontSize="xs">{timeRangeFormat(props.event.start, props.event.end)}</Text>
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
            <EventPopover event={props.event} />
          </PopoverContent>
        </Portal>
      </Popover>
    )
  } else {
    return renderEvent()
  }
}

export default function SearchResults(props: IProps) {
  const eventActionContext = React.useContext<EventActionContextType>(EventActionContext)
  if (eventActionContext.eventState.loading) {
    return (
      <Center w="100%" h="5em" overflow="auto">
        <Text color="gray.500">Searching..</Text>
      </Center>
    )
  }

  const sortedEvents = props.events.sort((a, b) => -sortEvents(a, b))
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
          <EventItem key={idx} event={event} />
        ))}
      </Box>
    )
  }
}
