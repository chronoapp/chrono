import React from 'react'
import clsx from 'clsx'

import { format } from '../util/localizer'
import * as dates from '../util/dates'

import Event from '../models/Event'
import WeekHeaderRow from './WeekHeaderRow'
import { EventService } from './event-edit/useEventService'

import { IconButton, Flex } from '@chakra-ui/react'
import { FiChevronUp, FiChevronDown } from 'react-icons/fi'
import { uiState } from '@/state/UIState'
import { useRecoilValue, useSetRecoilState } from 'recoil'

interface IProps {
  range: Date[]
  events: Event[]
  leftPad: number
  marginRight: number
  eventService: EventService
}

function ToggleExpandWeeklyRows(props: { expanded: boolean }) {
  const setUiState = useSetRecoilState(uiState)

  if (props.expanded) {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="collapse events"
        icon={<FiChevronUp />}
        onClick={() => setUiState({ expandWeeklyRows: false })}
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
        onClick={() => setUiState({ expandWeeklyRows: true })}
        width="4"
        mt="8"
      />
    )
  }
}

function TimeGridHeader(props: IProps) {
  const { expandWeeklyRows } = useRecoilValue(uiState)

  function renderHeaderCells() {
    const today = new Date() // TODO: pass via props.

    return props.range.map((date, i) => {
      const dayNumber = format(date, 'D')
      const dateString = format(date, 'ddd')
      const isToday = dates.eq(date, today, 'day')

      return (
        <div key={i} className={clsx('cal-header', dates.eq(date, today, 'day') && 'cal-today')}>
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
        <ToggleExpandWeeklyRows expanded={expandWeeklyRows} />
      </Flex>
      <div className="cal-time-header-content">
        <div className="cal-row">{renderHeaderCells()}</div>
        <WeekHeaderRow
          range={props.range}
          events={props.events}
          eventService={props.eventService}
          expandRows={expandWeeklyRows}
        />
      </div>
    </div>
  )
}

export default TimeGridHeader
