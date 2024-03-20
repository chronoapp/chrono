import React from 'react'
import { useSelect } from 'downshift'
import { Box, Flex, Icon } from '@chakra-ui/react'

import { FiArrowRight } from 'react-icons/fi'

import { formatTimeHmma } from '../../util/localizer'
import * as dates from '../../util/dates'
import { getDstOffset } from '../utils/SlotMetrics'

const INTERVAL = 15
interface TimeRangeSelectProps {
  start: Date
  end: Date
  onSelectStartDate: (date: Date) => void
  onSelectEndDate: (date: Date) => void
}

interface TimeOption {
  value: number
  label: string
  dst?: number
}

/**
 * Renders the start and end time selectors.
 */
function TimeRangeSelect(props: TimeRangeSelectProps) {
  const dayStart: Date = dates.startOf(props.start, 'day')
  const dayEnd: Date = dates.endOf(props.end, 'day')

  const startTimeOptions = getStartTimeOptions(dayStart, props.end)
  const endTimeOptions = getEndTimeOptions(props.start, dayEnd)

  return (
    <Flex flex="1.5" alignItems="center">
      <DateSelector
        timeOptions={startTimeOptions}
        date={props.start}
        onSelect={(idx) => {
          const date = dates.add(dayStart, idx * INTERVAL, 'minutes')
          props.onSelectStartDate(date)
        }}
      />

      <Icon as={FiArrowRight} color="gray.700" />

      <DateSelector
        timeOptions={endTimeOptions}
        date={props.end}
        onSelect={(idx) => {
          const date = dates.add(props.start, (idx + 1) * INTERVAL, 'minutes')
          props.onSelectEndDate(date)
        }}
      />
    </Flex>
  )
}

interface DateSelectorProps {
  timeOptions: TimeOption[]
  date: Date
  onSelect: (idx: number) => void
}

function DateSelector(props: DateSelectorProps) {
  const selectedLabel = formatTimeHmma(props.date)
  const defaultItem = props.timeOptions.find((item) => item.label == selectedLabel)

  function itemToString(item) {
    return item ? item.title : ''
  }

  function stateReducer(state, actionAndChanges) {
    const { changes } = actionAndChanges

    if (state.highlightedIndex === -1) {
      return {
        ...changes,
        highlightedIndex: defaultItem ? defaultItem.value : -1,
      }
    }

    return changes
  }

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    highlightedIndex,
    selectedItem,
    getItemProps,
  } = useSelect({
    items: props.timeOptions,
    itemToString,
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) {
        const idx = selectedItem.value
        props.onSelect(idx)
      }
    },
    initialSelectedItem: defaultItem,
    stateReducer: stateReducer,
  })

  return (
    <Box minW="16">
      <Box
        {...getToggleButtonProps()}
        _hover={{ bg: 'gray.100' }}
        borderRadius={'sm'}
        p="0.5"
        fontSize={'sm'}
      >
        {formatTimeHmma(props.date)}
      </Box>
      <Box
        {...getMenuProps()}
        hidden={!isOpen}
        position="absolute"
        boxShadow={'md'}
        direction="column"
        maxH={'12em'}
        overflowY="scroll"
        zIndex={10}
      >
        {isOpen &&
          props.timeOptions.map((item, index) => (
            <Box
              p="1"
              key={`dt_${index}`}
              border="1px solid"
              borderColor={'gray.100'}
              fontSize="xs"
              fontWeight={defaultItem?.value === item.value ? 'bold' : 'normal'}
              textColor={'gray.700'}
              _hover={{ bg: 'gray.100' }}
              bgColor={highlightedIndex == index ? 'gray.100' : 'white'}
              {...getItemProps({ item, index })}
            >
              {item.label}
            </Box>
          ))}
      </Box>
    </Box>
  )
}

export function formatDuration(duration: number) {
  if (duration <= dates.MILLI.hours) {
    return `${duration / dates.MILLI.minutes} m`
  }

  const hours = duration / dates.MILLI.hours
  return `${hours}h`
}

export function getStartTimeOptions(dayStart: Date, end: Date): TimeOption[] {
  const startTimeOptions: TimeOption[] = []
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
      label: `${formatTimeHmma(date)}`,
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
export function getEndTimeOptions(start: Date, dayEnd: Date): TimeOption[] {
  const endTimeOptions: TimeOption[] = []
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

    const option = { value: i, label: `${formatTimeHmma(date)}` }
    endTimeOptions.push(option)
  }

  return endTimeOptions
}

export default TimeRangeSelect
