import { useRecoilState, useRecoilValue } from 'recoil'

import { ZonedDateTime as DateTime, ChronoUnit } from '@js-joda/core'
import { formatDayOfMonth, formatThreeLetterWeekday } from '@/util/localizer-joda'
import * as dates from '@/util/dates-joda'

import User from '@/models/User'
import Event from '@/models/Event'
import Flags from '@/models/Flags'

import WeekHeaderRow from './WeekHeaderRow'
import { EventService } from './event-edit/useEventService'

import { IconButton, Flex } from '@chakra-ui/react'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'
import { calendarViewStateUserTimezone } from '@/state/CalendarViewState'

import TimezoneLabel from './TimezoneLabel'

import * as API from '@/util/Api'

interface IProps {
  range: DateTime[]
  events: Event[]
  leftPad: number
  marginRight: number
  eventService: EventService
  now: DateTime
  addGutter: any
  today: Date
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
        mt="2"
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
        mt="2"
      />
    )
  }
}

function ToogleAdditionalTimezone({ addGutter }) {
  return (
    <IconButton
      size={'xs'}
      variant="ghost"
      aria-label="adding additional timezones"
      icon={<FiPlus />}
      onClick={() => addGutter()}
      width="4"
    />
  )
}
function TimeGridHeader(props: IProps) {
  const { expandAllDayEvents, updateExpandAllDayEvents } = useUserFlags()
  const calendarViewState = useRecoilValue(calendarViewStateUserTimezone)

  function renderHeaderCells() {
    return props.range.map((date, i) => {
      const dayNumber = formatDayOfMonth(date)
      const dateString = formatThreeLetterWeekday(date)
      const isToday = dates.eq(date, calendarViewState.now, ChronoUnit.DAYS)

      return (
        <div
          key={i}
          className={clsx('cal-header', dates.eq(date, props.today, 'day') && 'cal-today')}
        >
          <VStack spacing={1}>
            <Box>
              <Text fontSize="xs">{dateString}</Text>
              <Text
                color={isToday ? 'white' : 'gray.600'}
                fontWeight={'500'}
                bg={isToday ? '#5c6bc0' : 'transparent'}
                borderRadius={5}
                px={'1.5'}
                py={'1'}
                fontSize="sm"
              >
                {dayNumber}
              </Text>
            </Box>
          </VStack>
        </Box>
      )
    })
  }
  return (
    <div style={{ marginRight: props.marginRight }} className={clsx('cal-time-header', 'mt-2')}>
      <Flex
        width={props.leftPad}
        direction={'column'}
        justifyContent={'flex-start'}
        alignItems={'center'}
        className="rbc-label cal-time-header-gutter"
      >
        <Flex>
          <ToogleAdditionalTimezone addGutter={props.addGutter} />
          <TimezoneLabel />
        </Flex>
        <ToggleExpandWeeklyRows expanded={expandAllDayEvents} />
      </Flex>
      <div className="cal-time-header-content">
        <div className="cal-row">{renderHeaderCells()}</div>
        <WeekHeaderRow
          range={props.range}
          events={props.events}
          eventService={props.eventService}
          expandRows={expandAllDayEvents}
          onShowMore={() => updateExpandAllDayEvents(true)}
          now={props.now}
        />
      </div>
    </div>
  )
}

function useUserFlags() {
  const [user, setUser] = useRecoilState(userState)
  const expandAllDayEvents = user?.flags.EXPAND_ALL_DAY_EVENTS || false

  function updateExpandAllDayEvents(expand: boolean) {
    const updatedFlags = { ...user?.flags, EXPAND_ALL_DAY_EVENTS: expand } as Flags

    setUser((state) =>
      state
        ? ({
            ...state,
            flags: updatedFlags,
          } as User)
        : state
    )

    user && API.updateUserFlags('EXPAND_ALL_DAY_EVENTS', expand)
  }

  return { expandAllDayEvents, updateExpandAllDayEvents }
}

export default TimeGridHeader
