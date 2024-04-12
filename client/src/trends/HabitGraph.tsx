import React, { useState, useEffect } from 'react'
import { Flex, Box, Text, IconButton } from '@chakra-ui/react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
} from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

import { useRecoilValue } from 'recoil'
import chunk from '@/lib/js-lib/chunk'

import { DateTime } from 'luxon'
import * as dates from '@/util/dates-luxon'
import {
  firstDayOfWeek,
  getWeekRange,
  formatFullDay,
  formatThreeLetterWeekday,
  formatDayOfMonth,
  formatMonthDay,
  formatMonthTitle,
} from '@/util/localizer-luxon'

import { hexToHSL } from '@/calendar/utils/Colors'
import { Label } from '@/models/Label'
import { getTrends } from '@/util/Api'

import { labelsState } from '@/state/LabelsState'
import ViewSelector, { TrendView } from './ViewSelector'
import TagDropdown from './TagDropdown'
import { interpolateLightness, calculateColor } from './util/color'

interface IProps {
  setSelectedView: (v: TrendView) => void
  selectedLabel?: Label
  setSelectedLabel: (label: Label) => void
}

function HabitGraph(props: IProps) {
  const labelState = useRecoilValue(labelsState)

  const [trendMap, setTrendMap] = useState<Map<string, number>>(undefined!)
  const [maxDuration, setMaxDuration] = useState(0)

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
    const maxDuration = Math.max(...trends.values)
    setMaxDuration(maxDuration)
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

  function renderWeek(week: DateTime[], idx: number) {
    const { h, s, l } = hexToHSL(props.selectedLabel!.color_hex)

    return (
      <Flex key={idx}>
        {week.map((day: DateTime, dayIdx: number) => {
          const dayKey = formatFullDay(day)
          const dayValue = day > curDate ? 0 : trendMap.get(dayKey) || 0
          const nextDayValue =
            dayIdx < week.length - 1 ? trendMap.get(formatFullDay(week[dayIdx + 1])) || 0 : 0
          const renderLink = dayValue > 0 && nextDayValue > 0

          const dayColor = calculateColor(dayValue, maxDuration, h, s, l)
          const nextDayColor = calculateColor(nextDayValue, maxDuration, h, s, l)

          let linkColor = dayColor
          if (renderLink) {
            linkColor = interpolateLightness(dayColor, nextDayColor)
          }

          return (
            <Popover isLazy trigger="hover" key={dayIdx}>
              <PopoverTrigger>
                <Flex
                  className="habit-chart-day"
                  backgroundColor={dayColor}
                  height="28"
                  width="28"
                  alignItems="flex-start"
                  justifyContent="flex-end"
                  border="1px solid"
                  borderColor={dayValue > 0 ? dayColor : 'transparent'} // Adjust border color based on activity
                  borderRadius="2xl"
                  flex="none"
                  m="1"
                  position="relative"
                >
                  {renderLink && (
                    <Box
                      className="consecutive-days-link"
                      position="absolute"
                      right="-9px"
                      top="50%"
                      width="2"
                      height="3"
                      backgroundColor={linkColor}
                    ></Box>
                  )}
                </Flex>
              </PopoverTrigger>
              <PopoverContent width={'xs'} color="white" bg="gray.600" borderColor="gray.600">
                <PopoverArrow bg="gray.600" borderColor="gray.600" />
                <PopoverBody textAlign={'center'}>
                  {dayValue > 0
                    ? `${dayValue} hours on ${formatMonthDay(day)}`
                    : `No activity on ${formatMonthDay(day)}`}
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

    return (
      <Box>
        <Flex mb="1">{renderHeader()}</Flex>
        {weeks.map(renderWeek)}
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
            onClick={() => setViewDate(viewDate.minus({ months: 1 }))}
          />
          <IconButton
            aria-label="right"
            variant="ghost"
            icon={<FiChevronRight />}
            onClick={() => setViewDate(viewDate.plus({ months: 1 }))}
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
