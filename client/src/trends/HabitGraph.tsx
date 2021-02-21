import React, { useState, useEffect, useContext } from 'react'
import chunk from 'lodash/chunk'
import clsx from 'clsx'
import { Container, Flex, Box, Text, IconButton } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

import { Label } from '@/models/Label'
import { startOfWeek, format, getWeekRange } from '@/util/localizer'
import { LabelContext } from '@/components/LabelsContext'

import { hexToHSL } from '@/calendar/utils/Colors'
import * as dates from '@/util/dates'
import { getTrends, getAuthToken } from '@/util/Api'
import ViewSelector, { TrendView } from './ViewSelector'
import TagDropdown from './TagDropdown'
interface IProps {
  setSelectedView: (v: TrendView) => void
  selectedLabel?: Label
  setSelectedLabel: (label: Label) => void
}

function HabitGraph(props: IProps) {
  const [trendMap, setTrendMap] = useState<Map<string, number>>(undefined!)
  const [maxDuration, setMaxDuration] = useState(0)

  const curDate = new Date()
  const labelsContext = useContext(LabelContext)
  const [viewDate, setViewDate] = useState(curDate)
  const month = dates.visibleDays(viewDate, startOfWeek(), true)
  const weeks = chunk(month, 7)

  useEffect(() => {
    updateTrendsData()
  }, [props.selectedLabel, viewDate])

  async function updateTrendsData() {
    if (!props.selectedLabel) {
      return
    }

    const authToken = getAuthToken()
    const start = dates.firstVisibleDay(viewDate, startOfWeek())
    const end = dates.lastVisibleDay(viewDate, startOfWeek())
    const trends = await getTrends(props.selectedLabel.id, authToken, 'DAY', start, end)

    const trendMap = new Map<string, number>()
    for (let i = 0; i < trends.labels.length; i++) {
      trendMap.set(trends.labels[i], trends.values[i])
    }
    const maxDuration = Math.max(...trends.values)
    console.log(maxDuration)
    setMaxDuration(maxDuration)
    setTrendMap(trendMap)
  }

  function renderHeader() {
    const range = getWeekRange(viewDate)
    return range.map((day, idx) => (
      <div key={idx} style={{ flex: 1 }}>
        {format(day, 'dd')}
      </div>
    ))
  }

  function renderWeek(week: Date[], idx: number) {
    const { h, s, l } = hexToHSL(props.selectedLabel!.color_hex)

    return (
      <Flex key={idx}>
        {week.map((day: Date, idx: number) => {
          const label = format(day, 'D')
          const dayKey = format(day, 'YYYY-MM-DD')
          const dayValue = day > curDate ? 0 : trendMap.get(dayKey)

          let color
          if (dayValue) {
            let addLight = 0
            if (maxDuration > 0) {
              const ratio = dayValue / maxDuration
              const remainingLight = 100 - l
              addLight = (1 - ratio) * remainingLight
            }

            if (dayValue > 0) {
              color = `hsl(${h}, ${s}%, ${l + addLight}%)`
            }
          }

          return (
            <div
              key={idx}
              className="habit-chart-day"
              style={{ height: '5em', backgroundColor: color }}
            >
              <div className={clsx('habit-chart-day-label')}>{label}</div>
            </div>
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
      <div>
        <Flex>{renderHeader()}</Flex>
        {weeks.map(renderWeek)}
      </div>
    )
  }

  return (
    <Container minW="3xl" maxW="5xl" mt="2">
      <Flex justifyContent="space-between">
        <Flex ml="2" alignItems="center" justifyContent="flex-start">
          <Text ml="2" mr="2">
            Habit Chart
          </Text>

          <TagDropdown
            selectedLabel={props.selectedLabel}
            onSelectLabel={(label) => props.setSelectedLabel(label)}
            labelsById={labelsContext.labelState.labelsById}
          />

          <IconButton
            aria-label="left"
            variant="ghost"
            icon={<FiChevronLeft />}
            onClick={() => setViewDate(dates.subtract(viewDate, 1, 'month'))}
          />
          <IconButton
            aria-label="right"
            variant="ghost"
            icon={<FiChevronRight />}
            onClick={() => setViewDate(dates.add(viewDate, 1, 'month'))}
          />

          <Text ml="2">{format(viewDate, 'MMMM YYYY')}</Text>
        </Flex>
        <ViewSelector setSelectedView={props.setSelectedView} selectedView={'HABIT_GRAPH'} />
      </Flex>

      <Box mt="2">{renderGraph()}</Box>
    </Container>
  )
}

export default HabitGraph
