import React from 'react'

import { useRecoilValue } from 'recoil'

import { Flex, Box, Text, Center, Tooltip } from '@chakra-ui/react'
import { FiRepeat } from 'react-icons/fi'

import { calendarWithDefault } from '@/state/CalendarState'
import useEventActions from '@/state/useEventActions'
import { ZonedDateTime as DateTime } from '@js-joda/core'

import {
  formatDayMonthYearWeekday,
  formatTimeRange,
  formatFullDay,
  yearStringToDate,
} from '@/util/localizer-joda'
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
  const eventActions = useEventActions()

  function onSelectEvent(event: Event) {
    eventActions.initEditEvent(event, false, 'FULL_EDIT')
  }

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

  function groupEventsByDay(events: Event[]): Record<string, Event[]> {
    const groups = events.reduce((acc, event) => {
      const date = formatFullDay(event.start)

      if (!acc[date]) {
        acc[date] = []
      }

      acc[date].push(event)

      return acc
    }, {})

    return groups
  }

  if (loading) {
    return (
      <Center w="100%" h="5em" overflow="auto">
        <Text color="gray.500">Searching..</Text>
      </Center>
    )
  }

  if (events.length === 0) {
    return (
      <Center w="100%" h="5em" overflow="auto">
        <Text color="gray.500">We couldn't find anything</Text>
      </Center>
    )
  }

  const groupedEvents = groupEventsByDay(events)

  return (
    <Box w="100%" height="calc(100vh - 3.25rem)" overflow="auto">
      {Object.keys(groupedEvents).map((key, idx) => {
        const events = groupedEvents[key]
        const date = yearStringToDate(key)

        return <EventGroup key={idx} events={events} date={date} onSelectEvent={onSelectEvent} />
      })}
    </Box>
  )
}

function EventGroup(props: {
  events: Event[]
  date: DateTime
  onSelectEvent: (event: Event) => void
}) {
  const dateDisplay = formatDayMonthYearWeekday(props.date)

  return (
    <Flex
      alignItems={'start'}
      borderBottom="1px solid"
      borderColor={'gray.200'}
      pl="5"
      pt="1"
      pb="1"
    >
      <Box w="8em" flexShrink={0} mt="1">
        <Text fontSize="sm" align="left">
          {dateDisplay}
        </Text>
      </Box>

      <Flex direction="column" w="100%" mr="2">
        {props.events.map((event, idx) => {
          return <EventItem key={idx} idx={idx} event={event} onSelectEvent={props.onSelectEvent} />
        })}
      </Flex>
    </Flex>
  )
}

function EventItem(props: { event: Event; idx: number; onSelectEvent: (event: Event) => void }) {
  const calendar = useRecoilValue(calendarWithDefault(props.event.calendar_id))

  return (
    <Flex
      direction={'column'}
      onClick={() => props.onSelectEvent(props.event)}
      width="100%"
      _hover={{
        background: 'gray.100',
        cursor: 'pointer',
      }}
      mt={props.idx !== 0 ? '1' : '0'}
      borderRadius={'sm'}
      p="1"
    >
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
  )
}
