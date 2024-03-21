import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'

import { useRecoilState } from 'recoil'
import { Box, Flex, Text } from '@chakra-ui/react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import clsx from 'clsx'
import chunk from '@/lib/js-lib/chunk'

import { visibleDays } from '@/util/dates-luxon'
import {
  firstDayOfWeek,
  getWeekRange,
  formatTwoLetterWeekday,
  formatDayOfMonth,
  formatMonthTitle,
} from '@/util/localizer-luxon'

import { displayState } from '@/state/EventsState'

type AnimateDirection = 'NONE' | 'FROM_BOTTOM' | 'FROM_TOP'

/**
 * Mini calendar for date selection.
 */
export default function MiniCalendar() {
  const [display, setDisplay] = useRecoilState(displayState)

  // Current view date (represents a month) of the calendar.
  const [viewDate, setViewDate] = useState<DateTime>(display.selectedDate)

  const month = visibleDays(viewDate, firstDayOfWeek(), true)
  const weeks = chunk(month, 7)
  const [animateDirection, setAnimateDirection] = useState<AnimateDirection>('NONE')
  const today = DateTime.now()

  useEffect(() => {
    setViewDate(display.selectedDate)
  }, [display.selectedDate])

  function renderHeader() {
    const range = getWeekRange(viewDate)
    return range.map((day, idx) => (
      <Text key={idx} className="cal-mini-month-day" fontSize={'xs'} size="xs">
        {formatTwoLetterWeekday(day)}
      </Text>
    ))
  }

  function renderWeek(week: DateTime[], idx: number) {
    const highlightWeek =
      display.view === 'Week' && week.find((day) => day.hasSame(display.selectedDate, 'day'))

    return (
      <Flex
        key={idx}
        width={'100%'}
        mt="1"
        mb="1"
        className={clsx(highlightWeek && 'cal-mini-week-selected')}
      >
        {week.map((day: DateTime, idx) => {
          const label = formatDayOfMonth(day)
          const isToday = day.hasSame(today, 'day')
          const isOffRange = viewDate.month !== day.month
          const isSelected = day.hasSame(display.selectedDate, 'day')

          return (
            <Text
              key={idx}
              onClick={() =>
                setDisplay((prev) => {
                  return { ...prev, selectedDate: day }
                })
              }
              mt="1px"
              mb="1px"
              fontSize={'xs'}
              _hover={{ cursor: 'pointer', bg: !isToday ? 'gray.100' : undefined }}
              backgroundColor={!isToday && isSelected ? 'gray.100' : undefined}
              className={clsx(
                'cal-mini-month-day',
                !isToday && isOffRange && 'has-text-grey',
                isToday && 'cal-mini-month-today-bg'
              )}
            >
              {label}
            </Text>
          )
        })}
      </Flex>
    )
  }

  return (
    <Box mt="1" pr="2">
      <Flex pl="1" justifyContent="space-between">
        <Text>{formatMonthTitle(viewDate)}</Text>
        <Flex>
          <span
            className="icon-button"
            onClick={() => {
              setAnimateDirection('FROM_TOP')
              setViewDate(viewDate.minus({ months: 1 }))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <FiChevronUp size={'1.25em'} />
          </span>
          <span
            onClick={() => {
              setAnimateDirection('FROM_BOTTOM')
              setViewDate(viewDate.plus({ months: 1 }))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <FiChevronDown size={'1.25em'} />
          </span>
        </Flex>
      </Flex>
      <Flex>{renderHeader()}</Flex>
      <Box
        className={clsx(
          animateDirection === 'FROM_BOTTOM' && 'animate-bottom',
          animateDirection === 'FROM_TOP' && 'animate-top'
        )}
      >
        {weeks.map(renderWeek)}
      </Box>
    </Box>
  )
}
