import React from 'react'
import { Flex, Select, Icon } from '@chakra-ui/react'
import { FiArrowRight } from 'react-icons/fi'

import { format } from '../../util/localizer'
import * as dates from '../../util/dates'
import { getDstOffset } from '../../calendar/utils/SlotMetrics'

interface IProps {
  start: Date
  end: Date
  onSelectStartDate: (date: Date) => void
  onSelectEndDate: (date: Date) => void
}

const INTERVAL = 15

export function formatDuration(duration: number) {
  if (duration <= dates.MILLI.hours) {
    return `${duration / dates.MILLI.minutes} m`
  }

  const hours = duration / dates.MILLI.hours
  return `${hours}h`
}

export function getStartTimeOptions(dayStart: Date, end: Date) {
  const startTimeOptions: { value: number; label: string }[] = []
  const daystartdstoffset = getDstOffset(dayStart, end)

  const totalMin = 1 + dates.diff(end, dayStart, 'minutes') + getDstOffset(dayStart, end)
  const numOptions = Math.ceil(totalMin / INTERVAL)

  for (let i = 0; i < numOptions - 1; i++) {
    const minFromStart = i * INTERVAL

    let date = new Date(
      dayStart.getFullYear(),
      dayStart.getMonth(),
      dayStart.getDate(),
      0,
      minFromStart,
      0,
      0
    )

    const option = {
      value: i,
      label: `${format(date, 'h:mm A')}`,
      dst: getDstOffset(dayStart, date),
    }
    startTimeOptions.push(option)
  }

  return startTimeOptions
}

/**
 * Options from the event's start + 15 minutes until
 * the end of the day.
 *
 * Have to construct the date objects from scratch to prevent
 * the DST infinite loop from incrementing dates.
 */
export function getEndTimeOptions(start: Date, dayEnd: Date) {
  const endTimeOptions: { value: number; label: string }[] = []
  let endDate: Date = dates.add(start, INTERVAL, 'minutes')

  const daystart = dates.startOf(start, 'day')
  const daystartdstoffset = getDstOffset(daystart, start)

  const totalMin = 1 + dates.diff(dayEnd, endDate, 'minutes') + getDstOffset(start, dayEnd)
  const numOptions = Math.ceil(totalMin / INTERVAL)

  const minutesFromMidnight = dates.diff(daystart, start, 'minutes') + daystartdstoffset

  for (let i = 0; i < numOptions + 1; i++) {
    const minFromStart = minutesFromMidnight + (i + 1) * INTERVAL

    const date = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      0,
      minFromStart,
      0,
      0
    )

    const option = { value: i, label: `${format(date, 'h:mm A')}` }
    endTimeOptions.push(option)
  }

  return endTimeOptions
}

/**
 * Renders the start and end time selectors.
 */
function TimeSelect(props: IProps) {
  const dayStart: Date = dates.startOf(props.start, 'day')
  const dayEnd: Date = dates.endOf(props.end, 'day')

  const startIdx = Math.round(dates.diff(dayStart, props.start, 'minutes') / INTERVAL)
  const startTimeOptions = getStartTimeOptions(dayStart, props.end)

  const endIdx = Math.round(dates.diff(props.end, props.start, 'minutes') / INTERVAL) - 1
  const endTimeOptions = getEndTimeOptions(props.start, dayEnd)

  return (
    <Flex flex="1.5" alignItems="center">
      <Select
        ml="1"
        size="sm"
        maxHeight="12em"
        variant="unstyled"
        value={startIdx}
        onChange={(e) => {
          const idx = parseInt(e.target.value)
          const date = dates.add(dayStart, idx * INTERVAL, 'minutes')
          props.onSelectStartDate(date)
        }}
      >
        {startTimeOptions.map((option, idx) => (
          <option key={`start_${idx}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Icon as={FiArrowRight} />
      <Select
        ml="1"
        size="sm"
        variant="unstyled"
        value={endIdx}
        onChange={(e) => {
          const idx = parseInt(e.target.value)
          const date = dates.add(props.start, (idx + 1) * INTERVAL, 'minutes')
          props.onSelectEndDate(date)
        }}
      >
        {endTimeOptions.map((option, idx) => (
          <option key={`end_${idx}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Flex>
  )
}

export default TimeSelect
