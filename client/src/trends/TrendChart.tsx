import React from 'react'
import clsx from 'clsx'
import { Button, Center, Flex, Box, Text } from '@chakra-ui/react'
import { Bar } from 'react-chartjs-2'
import { useRecoilValue } from 'recoil'

import { ChronoUnit } from '@js-joda/core'
import * as dates from '@/util/dates-joda'
import * as localizer from '@/util/localizer-joda'

import { getTrends } from '@/util/Api'
import { Label, TimePeriod } from '@/models/Label'

import ViewSelector, { TrendView } from './ViewSelector'
import TagDropdown from './TagDropdown'
import { labelsState } from '@/state/LabelsState'
import { calendarViewState } from '@/state/CalendarViewState'

interface IProps {
  setSelectedView: (view: TrendView) => void
  selectedLabel?: Label
  setSelectedLabel: (label: Label) => void
}

/**
 * List of trends.
 */
function TrendChart(props: IProps) {
  const [trends, setTrends] = React.useState<any>({})
  const [selectedTimePeriod, setSelectedTimePeriod] = React.useState<TimePeriod>('WEEK')
  const calendarView = useRecoilValue(calendarViewState)
  const labelState = useRecoilValue(labelsState)

  React.useEffect(() => {
    updateTrendsData()
  }, [selectedTimePeriod, props.selectedLabel])

  async function updateTrendsData() {
    if (props.selectedLabel) {
      const end = calendarView.now

      let start
      if (selectedTimePeriod === 'MONTH') {
        start = dates.subtract(end, 12, ChronoUnit.MONTHS)
      } else if (selectedTimePeriod === 'WEEK') {
        start = dates.subtract(end, 12, ChronoUnit.WEEKS)
      } else if (selectedTimePeriod === 'DAY') {
        start = dates.subtract(end, 30, ChronoUnit.DAYS)
      }

      const trends = await getTrends(props.selectedLabel.id, selectedTimePeriod, start, end)
      setTrends(trends)
    }
  }

  function renderTimePeriodSelections() {
    return (
      <Box ml="2">
        <Button
          p="1"
          size="sm"
          variant="ghost"
          borderRadius="none"
          fontWeight="normal"
          _hover={{ background: 'none' }}
          _active={{ background: 'none' }}
          onClick={() => setSelectedTimePeriod('DAY')}
          className={clsx('button-underline', selectedTimePeriod === 'DAY' && 'is-active')}
        >
          Day
        </Button>
        <Button
          ml="2"
          p="1"
          size="sm"
          variant="ghost"
          borderRadius="none"
          fontWeight="normal"
          _hover={{ background: 'none' }}
          _active={{ background: 'none' }}
          onClick={() => setSelectedTimePeriod('WEEK')}
          className={clsx('button-underline', selectedTimePeriod === 'WEEK' && 'is-active')}
        >
          Week
        </Button>
        <Button
          ml="2"
          p="1"
          size="sm"
          variant="ghost"
          borderRadius="none"
          fontWeight="normal"
          _hover={{ background: 'none' }}
          _active={{ background: 'none' }}
          onClick={() => setSelectedTimePeriod('MONTH')}
          className={clsx('button-underline', selectedTimePeriod === 'MONTH' && 'is-active')}
        >
          Month
        </Button>
      </Box>
    )
  }

  function renderChart(labels: Record<number, Label>) {
    const options = {
      title: {
        text: 'Work over Time',
      },
      layout: {
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      },
      scales: {
        yAxes: [
          {
            display: true,
            ticks: {
              suggestedMin: 0, // minimum will be 0, unless there is a lower value.
            },
            scaleLabel: {
              display: true,
              labelString: 'Hours per 7 days',
            },
          },
        ],
      },
      legend: {
        display: false,
      },
    }

    const label = props.selectedLabel ? props.selectedLabel : Object.values(labels)[0]
    const colorHex = label ? label.color_hex : 'white'
    const labelsDisplay = trends.labels
      ? trends.labels.map((label) => {
          const date = localizer.yearStringToDate(label)
          return localizer.formatMonthDayYear(date)
        })
      : []

    const data = {
      labels: labelsDisplay,
      datasets: [
        {
          label: 'Hours',
          borderColor: '#165cad',
          fill: false,
          data: trends.values,
          backgroundColor: colorHex,
        },
      ],
    }
    return <Bar data={data} options={options} />
  }

  function renderEmpty() {
    return (
      <Center w="100%" h="2xl" overflow="auto">
        <Box textAlign={'center'}>
          <Text fontWeight="medium">No tags</Text>
          <Text fontSize="sm" mt="1">
            Create a tag and add it to your events to view your trends.
          </Text>
        </Box>
      </Center>
    )
  }

  if (!labelState.loading && Object.keys(labelState.labelsById).length == 0) {
    return renderEmpty()
  } else {
    return (
      <Box pb="2">
        <Flex justifyContent="space-between">
          <Flex ml="2" alignItems="center" justifyContent="flex-start">
            <TagDropdown
              labelsById={labelState.labelsById}
              selectedLabel={props.selectedLabel}
              onSelectLabel={(label) => props.setSelectedLabel(label)}
            />
            <Text>per</Text>
            {renderTimePeriodSelections()}
          </Flex>

          <ViewSelector setSelectedView={props.setSelectedView} selectedView={'CHART'} />
        </Flex>

        <Box mt="2">{renderChart(labelState.labelsById)}</Box>
      </Box>
    )
  }
}

export default TrendChart
