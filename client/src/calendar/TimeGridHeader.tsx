import clsx from 'clsx'
import { useRecoilState } from 'recoil'

import { DateTime } from 'luxon'

import { formatDayOfMonth, formatThreeLetterWeekday } from '@/util/localizer-luxon'
import * as dates from '@/util/dates-luxon'

import User from '@/models/User'
import Event from '@/models/Event'

import WeekHeaderRow from './WeekHeaderRow'
import { EventService } from './event-edit/useEventService'

import { IconButton, Flex, Box, Text, VStack, Divider } from '@chakra-ui/react'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'

import * as API from '@/util/Api'

interface IProps {
  range: DateTime[]
  events: Event[]
  leftPad: number
  marginRight: number
  eventService: EventService
}

function ToggleExpandWeeklyRows(props: { expanded: boolean }) {
  const { updateExpandAllDayEvents } = useUserFlags()

  if (props.expanded) {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="collapse events"
        icon={<FiChevronUp />}
        onClick={() => updateExpandAllDayEvents(false)}
        width="4"
        mt="8"
      />
    )
  } else {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="expand events"
        icon={<FiChevronDown />}
        onClick={() => updateExpandAllDayEvents(true)}
        width="4"
        mt="8"
      />
    )
  }
}

function TimeGridHeader(props: IProps) {
  const { expandAllDayEvents, updateExpandAllDayEvents } = useUserFlags()

  function renderHeaderCells() {
    const today = DateTime.now()

    return props.range.map((date, i) => {
      const dayNumber = formatDayOfMonth(date)
      const dateString = formatThreeLetterWeekday(date)
      const isToday = dates.eq(date, today, 'day')

      return (
        <Box
          key={i}
          display="flex"
          flexDirection="column"
          alignItems="center"
          p={2}
          className={isToday ? 'cal-today' : ''}
        >
          <VStack spacing={1}>
            <Box>
              <Text
                color={isToday ? 'white' : 'gray.600'}
                fontWeight={'500'}
                bg={isToday ? '#5c6bc0' : 'transparent'}
                borderRadius={5}
                px={1}
                py={'0.5'}
                fontSize="sm"
              >
                {dayNumber}
              </Text>
              <Text fontSize="xs">{dateString}</Text>
            </Box>
          </VStack>
        </Box>
      )
    })
  }

  return (
    <Flex
      className="cal-time-header"
      style={{ marginRight: props.marginRight }}
      display="flex"
      flex="0 0 auto"
      flexDirection="row"
    >
      <Flex
        className="rbc-label cal-time-header-gutter"
        width={props.leftPad}
        direction={'column'}
        justifyContent={'flex-start'}
        alignItems={'center'}
        position="sticky"
        left="0"
        background-color="white"
        z-index="10"
        margin-right="-1px"
      >
        <ToggleExpandWeeklyRows expanded={expandAllDayEvents} />
      </Flex>
      <Flex
        className="cal-time-header-content"
        flex={1}
        minWidth="0"
        flexDirection="column"
        borderLeft="1px solid"
        borderColor="rgb(235, 235, 235)"
        boxShadow="-2px 2px 3px 0 lightgrey"
      >
        <Flex
          className="cal-row"
          display="flex"
          flex-direction="row"
          justifyContent="space-around"
          borderLeft="1px solid"
          borderColor="rgb(235, 235, 235)"
        >
          {renderHeaderCells()}
        </Flex>
        <WeekHeaderRow
          range={props.range}
          events={props.events}
          eventService={props.eventService}
          expandRows={expandAllDayEvents}
          onShowMore={() => updateExpandAllDayEvents(true)}
        />
      </Flex>
    </Flex>
  )
}

function useUserFlags() {
  const [user, setUser] = useRecoilState(userState)
  const expandAllDayEvents = user?.flags.EXPAND_ALL_DAY_EVENTS || false

  function updateExpandAllDayEvents(expand: boolean) {
    const updatedFlags = { ...user?.flags, EXPAND_ALL_DAY_EVENTS: expand }

    setUser((state) =>
      state
        ? ({
            ...state,
            flags: updatedFlags,
          } as User)
        : state
    )

    user && API.updateUserFlags(updatedFlags)
  }

  return { expandAllDayEvents, updateExpandAllDayEvents }
}

export default TimeGridHeader
