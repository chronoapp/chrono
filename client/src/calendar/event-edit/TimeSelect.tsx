import React from 'react'
import { Flex, Select, Text } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import { format } from '../../util/localizer'
import * as dates from '../../util/dates'

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

/**
 * Renders the start and end time selectors.
 */
function TimeSelect(props: IProps) {
  const dayStart: Date = dates.startOf(props.start, 'day')
  const dayEnd: Date = dates.endOf(props.start, 'day')

  const startIdx = Math.round(dates.diff(dayStart, props.start, 'minutes') / INTERVAL)
  const startTimeOptions: { value: number; label: string }[] = []

  let startDate: Date = dayStart
  let idx = 0
  while (dates.lt(startDate, dates.subtract(props.end, INTERVAL, 'minutes'))) {
    startDate = dates.add(dayStart, INTERVAL * idx, 'minutes')
    const option = { value: idx, label: format(startDate, 'h:mm A') }
    startTimeOptions.push(option)
    idx += 1
  }

  const endIdx = Math.round(dates.diff(props.end, props.start, 'minutes') / INTERVAL) - 1
  const endTimeOptions: { value: number; label: string }[] = []
  let endDate: Date = props.start
  idx = 0
  while (dates.gt(dayEnd, endDate)) {
    endDate = dates.add(endDate, INTERVAL, 'minutes')
    const option = { value: idx, label: `${format(endDate, 'h:mm A')}` }
    endTimeOptions.push(option)
    idx += 1
  }

  return (
    <Flex flex="1.5" alignItems="center">
      <Select
        ml="1"
        size="sm"
        maxHeight="12em"
        icon={<FiChevronDown />}
        value={startTimeOptions[startIdx].value}
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
      <Text ml="1">to</Text>
      <Select
        ml="1"
        size="sm"
        icon={<FiChevronDown />}
        value={endTimeOptions[endIdx].value}
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
