import React, { useState, useEffect, useRef } from 'react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Flex,
  Box,
  Text,
  IconButton,
} from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import chunk from '@/lib/js-lib/chunk'

import { ChronoUnit, ZonedDateTime as DateTime, DayOfWeek } from '@js-joda/core'
import { DateTimeFormatter } from '@js-joda/core'
import * as dates from '@/util/dates-joda'
import {
  firstDayOfWeek,
  getWeekRange,
  formatFullDay,
  formatThreeLetterWeekday,
  formatDayOfMonth,
  formatMonthDay,
  formatMonthTitle,
  yearStringToDate,
} from '@/util/localizer-joda'

import { hexToHSL } from '@/calendar/utils/Colors'
import { Label } from '@/models/Label'
import { getTrends } from '@/util/Api'
import { labelsState } from '@/state/LabelsState'
import ViewSelector, { TrendView } from './ViewSelector'
import TagDropdown from './TagDropdown'

interface TrendBlock {
  day: DateTime
  color: string
  link?: TrendLink
}

interface TrendLink {
  color: string
  density: number
}
interface IProps {
  setSelectedView: (v: TrendView) => void
  selectedLabel?: Label
  setSelectedLabel: (label: Label) => void
}
function getTrendBlocks(
  trendsMap: Map<string, number>,
  maxDuration: number,
  color_hex: string
): TrendBlock[] {
  let consecutiveDays = 0
  let trendBlocks: TrendBlock[] = []
  let entries = Array.from(trendsMap.entries())
  const { h, s, l } = hexToHSL(color_hex)
  for (let i = 0; i < entries.length; i++) {
    const [dayString, value] = entries[i]
    const day = yearStringToDate(dayString)
    let color = calculateColor(value, maxDuration, h, s, l)
    let block: TrendBlock = { day, color }

    if (value > 0) {
      consecutiveDays++
      let nextValue = i + 1 < entries.length ? entries[i + 1][1] : 0
      if (nextValue > 0 && day.dayOfWeek() !== DayOfWeek.SATURDAY) {
        block.link = {
          color: calculateColor(consecutiveDays * (maxDuration / 5), maxDuration, h, s, l),
          density: consecutiveDays,
        }
      } else {
        consecutiveDays = 0
      }
    }
    trendBlocks.push(block)
  }

  return trendBlocks
}
function calculateColor(value, maxDuration, h, s, l) {
  if (value === 0 || maxDuration === 0) {
    return '#E0E0E0' // Default color for days with no activity
  }
  const ratio = value / maxDuration
  const remainingLight = 100 - l
  const addLight = (1 - ratio) * remainingLight
  return `hsl(${h}, ${s}%, ${l + addLight}%)`
}
function HabitGraph(props: IProps) {
  const labelState = useRecoilValue(labelsState)

  const [trendMap, setTrendMap] = useState<Map<string, number>>(undefined!)

  const curDate: DateTime = DateTime.now()
  const [viewDate, setViewDate] = useState<DateTime>(curDate)
  const month = dates.visibleDays(viewDate, firstDayOfWeek(), true)

  const weeks = chunk(month, 7)

  useEffect(() => {
    updateTrendsData()
  }, [props.selectedLabel, viewDate])

  async function updateTrendsData() {
    if (!props.selectedLabel) {
      return
    }

    const start = dates.firstVisibleDay(viewDate, firstDayOfWeek())
    const end = dates.lastVisibleDay(viewDate, firstDayOfWeek())
    const trends = await getTrends(props.selectedLabel.id, 'DAY', start, end)

    const trendMap = new Map<string, number>()
    for (let i = 0; i < trends.labels.length; i++) {
      trendMap.set(trends.labels[i], trends.values[i])
    }
    setTrendMap(trendMap)
  }

  function renderHeader() {
    const range = getWeekRange(viewDate)
    return range.map((day, idx) => (
      <Flex key={idx} flex="1" justifyContent={'center'}>
        <Text color="gray.600">{formatThreeLetterWeekday(day)}</Text>
      </Flex>
    ))
  }

  function renderWeek(week: DateTime[], idx: number, trendBlocks: TrendBlock[]) {
    return (
      <Flex key={idx}>
        {week.map((day: DateTime, dayIdx: number) => {
          const dayKey = formatFullDay(day)
          const trendValue = trendMap.get(dayKey)
          const trendBlock = trendBlocks.find((block) => formatFullDay(block.day) === dayKey)

          if (!trendBlock) return null

          return (
            <Popover isLazy trigger="hover" key={dayIdx}>
              <PopoverTrigger>
                <Flex
                  className="habit-chart-day"
                  backgroundColor={trendBlock.color}
                  height="6.5rem"
                  width="6.5rem"
                  alignItems="flex-start"
                  justifyContent="flex-end"
                  borderRadius="2xl"
                  flex="none"
                  my="1"
                  mx="2"
                  position="relative"
                >
                  {trendBlock.link && (
                    <Box
                      position="absolute"
                      right="-4"
                      top="50%"
                      width="4"
                      height="3"
                      backgroundColor={trendBlock.link.color}
                    ></Box>
                  )}
                </Flex>
              </PopoverTrigger>
              <PopoverContent width={'xs'} color="white" bg="gray.600" borderColor="gray.600">
                <PopoverArrow bg="gray.600" borderColor="gray.600" />
                <PopoverBody textAlign={'center'}>
                  {trendValue !== undefined
                    ? trendValue > 0
                      ? `${trendValue} hours on ${formatMonthDay(day)}`
                      : `No activity on ${formatMonthDay(day)}`
                    : 'No data for this day'}
                </PopoverBody>
              </PopoverContent>
            </Popover>
          )
        })}
      </Flex>
    )
  }

  function renderGraph() {
    if (!trendMap || !props.selectedLabel) {
      return
    }
    const maxDuration = Math.max(...Array.from(trendMap.values()))
    const trendBlocks = getTrendBlocks(trendMap, maxDuration, props.selectedLabel.color_hex)

    return (
      <Box>
        <Flex mb="1">{renderHeader()}</Flex>
        {weeks.map((week, idx) => {
          return renderWeek(week, idx, trendBlocks)
        })}
        {renderLessMoreAxis()}
      </Box>
    )
  }

  function renderLessMoreAxis() {
    const { h, s, l } = hexToHSL(props.selectedLabel!.color_hex)
    const numIndices = 5
    const indices = Array.from({ length: numIndices }, (_, i) => i + 1)

    return (
      <Flex justifyContent={'flex-end'} mt="5" mb="5">
        <Flex alignItems={'center'}>
          <Text fontSize="sm" color={'gray.500'} mr="2">
            Less
          </Text>
          <Flex direction={'row'}>
            {indices.map((i) => {
              const ratio = (1.0 * i) / numIndices
              const remainingLight = 100 - l
              const addLight = (1 - ratio) * remainingLight
              const color = `hsl(${h}, ${s}%, ${l + addLight}%)`

              return <Box key={i} mr="1" width="25px" height="25px" bgColor={color}></Box>
            })}
          </Flex>
          <Text fontSize="sm" color={'gray.500'} ml="2">
            More
          </Text>
        </Flex>
      </Flex>
    )
  }

  return (
    <>
      <Flex justifyContent="space-between">
        <Flex ml="2" alignItems="center" justifyContent="flex-start">
          <TagDropdown
            selectedLabel={props.selectedLabel}
            onSelectLabel={(label) => props.setSelectedLabel(label)}
            labelsById={labelState.labelsById}
          />

          <IconButton
            aria-label="left"
            variant="ghost"
            icon={<FiChevronLeft />}
            onClick={() => setViewDate(dates.subtract(viewDate, 1, ChronoUnit.MONTHS))}
          />
          <IconButton
            aria-label="right"
            variant="ghost"
            icon={<FiChevronRight />}
            onClick={() => setViewDate(dates.add(viewDate, 1, ChronoUnit.MONTHS))}
          />

          <Text ml="2">{formatMonthTitle(viewDate)}</Text>
        </Flex>
        <ViewSelector setSelectedView={props.setSelectedView} selectedView={'HABIT_GRAPH'} />
      </Flex>

      <Box mt="4">{renderGraph()}</Box>
    </>
  )
}

export default HabitGraph
