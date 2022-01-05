import React from 'react'
import { Flex, Box, Text } from '@chakra-ui/react'

import { CalendarsContext, CalendarsContextType } from '@/contexts/CalendarsContext'
import { EventActionContext, EventActionContextType } from '@/calendar/EventActionContext'
import { format, timeRangeFormat } from '@/util/localizer'
import { LabelTag } from '@/components/LabelTag'

import Event from '@/models/Event'
import * as API from '@/util/Api'

interface IProps {
  search: string
  events: Event[]
}

function EventItem(props: { event: Event }) {
  const calendarContext = React.useContext<CalendarsContextType>(CalendarsContext)
  const dateDisplay = format(props.event.start, 'D MMM YYYY, ddd')
  const color = calendarContext.getCalendarColor(props.event.calendar_id)

  return (
    <Flex
      alignItems={'center'}
      borderBottom="1px solid"
      borderColor={'gray.200'}
      pl="5"
      pt="1"
      pb="1"
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

export default function SearchResults(props: IProps) {
  return (
    <Box w="100%" height="calc(100vh - 3.25rem)" overflow="auto">
      {props.events.map((event, idx, arr) => (
        <EventItem key={idx} event={event} />
      ))}
    </Box>
  )
}
