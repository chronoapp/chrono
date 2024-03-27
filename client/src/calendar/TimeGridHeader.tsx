import clsx from 'clsx'
import { useRecoilState } from 'recoil'

import { DateTime } from 'luxon'

import { formatDayOfMonth, formatThreeLetterWeekday } from '@/util/localizer-luxon'
import * as dates from '@/util/dates-luxon'

import User from '@/models/User'
import Event from '@/models/Event'

import WeekHeaderRow from './WeekHeaderRow'
import { EventService } from './event-edit/useEventService'

import { IconButton, Flex } from '@chakra-ui/react'
import { FiChevronUp, FiChevronDown, FiPlus } from 'react-icons/fi'
import { userState } from '@/state/UserState'

import TimezoneLabel from './TimezoneLabel'

import * as API from '@/util/Api'

interface IProps {
  range: DateTime[]
  events: Event[]
  leftPad: number
  marginRight: number
  eventService: EventService
  addGutter: any
  today: DateTime
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

  function renderHeaderCells() {
    return props.range.map((date, i) => {
      const dayNumber = formatDayOfMonth(date)
      const dateString = formatThreeLetterWeekday(date)
      const isToday = dates.eq(date, props.today, 'day')

      return (
        <div
          key={i}
          className={clsx('cal-header', dates.eq(date, props.today, 'day') && 'cal-today')}
        >
          <span className={clsx(isToday && 'cal-header-day-selected', 'cal-header-day')}>
            <div
              className={clsx(
                'cal-header-day-rectangle',
                !isToday && 'has-text-grey-dark',
                isToday && 'cal-today-bg'
              )}
            >
              <span className="is-size-6">{dayNumber}</span>{' '}
              <span className="is-size-7">{dateString}</span>
            </div>
          </span>
          <span className="cal-divider"></span>
        </div>
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
        />
      </div>
    </div>
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
