import React, { useState, useEffect } from 'react'
import { useRecoilState } from 'recoil'
import { Box, Flex, Text } from '@chakra-ui/react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import clsx from 'clsx'
import chunk from '@/lib/js-lib/chunk'

import { displayState } from '@/state/EventsState'
import * as dates from '../util/dates'
import { startOfWeek, getWeekRange } from '../util/localizer'
import { format } from '../util/localizer'

type AnimateDirection = 'NONE' | 'FROM_BOTTOM' | 'FROM_TOP'

/**
 * Mini calendar for date selection.
 */
export default function MiniCalendar() {
  const [display, setDisplay] = useRecoilState(displayState)

  // Current view date (represents a month) of the calendar.
  const [viewDate, setViewDate] = useState<Date>(display.selectedDate)

  const month = dates.visibleDays(viewDate, startOfWeek(), true)
  const weeks = chunk(month, 7)
  const [animateDirection, setAnimateDirection] = useState<AnimateDirection>('NONE')
  const today = new Date()

  useEffect(() => {
    setViewDate(display.selectedDate)
  }, [display.selectedDate])

  function renderHeader() {
    const range = getWeekRange(viewDate)
    return range.map((day, idx) => (
      <Text key={idx} className="cal-mini-month-day" size="xs">
        {format(day, 'dd')}
      </Text>
    ))
  }

  function renderWeek(week: Date[], idx: number) {
    return (
      <Flex key={idx} width={'100%'}>
        {week.map((day: Date, idx) => {
          const label = format(day, 'D')
          const isToday = dates.eq(day, today, 'day')
          const isOffRange = dates.month(viewDate) !== dates.month(day)
          const isSelected = dates.eq(day, display.selectedDate, 'day')

          return (
            <Text
              key={idx}
              onClick={() =>
                setDisplay((prev) => {
                  return { ...prev, selectedDate: day }
                })
              }
              className={clsx(
                'cal-mini-month-day',
                !isToday && isOffRange && 'has-text-grey',
                !isToday && isSelected && 'cal-mini-month-day-selected',
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
    <Box mt="1" pr="1">
      <Flex pl="1" justifyContent="space-between">
        <Text>{format(viewDate, 'MMMM YYYY')}</Text>
        <Flex>
          <span
            className="icon-button"
            onClick={() => {
              setAnimateDirection('FROM_TOP')
              setViewDate(dates.subtract(viewDate, 1, 'month'))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <FiChevronUp size={'1.25em'} />
          </span>
          <span
            onClick={() => {
              setAnimateDirection('FROM_BOTTOM')
              setViewDate(dates.add(viewDate, 1, 'month'))
              setTimeout(() => setAnimateDirection('NONE'), 200)
            }}
          >
            <FiChevronDown size={'1.25em'} />
          </span>
        </Flex>
      </Flex>
      <Flex>{renderHeader()}</Flex>
      <div
        className={clsx(
          animateDirection === 'FROM_BOTTOM' && 'animate-bottom',
          animateDirection === 'FROM_TOP' && 'animate-top'
        )}
      >
        {weeks.map(renderWeek)}
      </div>
    </Box>
  )
}
