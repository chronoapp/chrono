import { useState, useEffect } from 'react'

import { useRecoilState, useRecoilValue } from 'recoil'
import { Box, Flex, Text } from '@chakra-ui/react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import clsx from 'clsx'
import chunk from '@/lib/js-lib/chunk'

import { ChronoUnit, ZonedDateTime as DateTime } from '@js-joda/core'
import { visibleDays } from '@/util/dates-joda'
import {
  firstDayOfWeek,
  getWeekRange,
  formatTwoLetterWeekday,
  formatDayOfMonth,
  formatMonthTitle,
} from '@/util/localizer-joda'
import * as dates from '@/util/dates-joda'

import { calendarViewState, calendarViewStateUserTimezone } from '@/state/CalendarViewState'

type AnimateDirection = 'NONE' | 'FROM_BOTTOM' | 'FROM_TOP'

/**
 * Mini calendar for date selection.
 */
export default function MiniCalendar() {
  const [calendarView, setCalendarView] = useRecoilState(calendarViewState)
  const calendarViewUserTimezone = useRecoilValue(calendarViewStateUserTimezone)
  const { selectedDate, now } = calendarViewUserTimezone

  // Current view date (represents a month) of the calendar.
  const [viewDate, setViewDate] = useState<DateTime>(selectedDate)

  const month = visibleDays(viewDate, firstDayOfWeek(), true)
  const weeks = chunk(month, 7)
  const [animateDirection, setAnimateDirection] = useState<AnimateDirection>('NONE')

  useEffect(() => {
    setViewDate(selectedDate)
  }, [selectedDate])

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
      calendarView.view === 'Week' &&
      week.find((day) => dates.hasSame(day, selectedDate, ChronoUnit.DAYS))

    return (
      <Flex
        key={idx}
        width={'100%'}
        mt="1"
        mb="1"
        pr="1"
        pl="1"
        borderRadius={highlightWeek ? 'sm' : undefined}
        bgColor={highlightWeek ? 'gray.200' : undefined}
      >
        {week.map((day: DateTime, idx) => {
          const label = formatDayOfMonth(day)
          const isToday = dates.hasSame(day, now, ChronoUnit.DAYS)
          const isOffRange = viewDate.month !== day.month
          const isSelected = dates.hasSame(day, selectedDate, ChronoUnit.DAYS)

          return (
            <Text
              key={idx}
              onClick={() =>
                setCalendarView((prev) => {
                  return { ...prev, selectedDate: day }
                })
              }
              mt="1px"
              mb="1px"
              fontSize={'xs'}
              _hover={{ cursor: 'pointer', bg: !isToday ? 'gray.200' : undefined }}
              backgroundColor={!isToday && isSelected ? 'gray.200' : undefined}
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
              setViewDate(dates.subtract(viewDate, 1, ChronoUnit.MONTHS))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <FiChevronUp size={'1.25em'} />
          </span>
          <span
            className="icon-button"
            onClick={() => {
              setAnimateDirection('FROM_BOTTOM')
              setViewDate(dates.add(viewDate, 1, ChronoUnit.MONTHS))
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
