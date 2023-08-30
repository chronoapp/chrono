import React from 'react'
import clsx from 'clsx'
import { Button, Center, Flex, Box, Text } from '@chakra-ui/react'
import { Bar } from 'react-chartjs-2'

import * as dates from '@/util/dates'
import { getTrends } from '@/util/Api'
import { Label, TimePeriod } from '@/models/Label'

import ViewSelector, { TrendView } from './ViewSelector'
import TagDropdown from './TagDropdown'
import { useRecoilValue } from 'recoil'
import { labelsState } from '@/state/LabelsState'

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
  const labelState = useRecoilValue(labelsState)

  React.useEffect(() => {
    updateTrendsData()
  }, [])

  React.useEffect(() => {
    updateTrendsData()
  }, [selectedTimePeriod, props.selectedLabel])

  async function updateTrendsData() {
    if (props.selectedLabel) {
      const end = new Date()
      let start

      if (selectedTimePeriod === 'MONTH') {
        start = dates.subtract(end, 12, 'month')
      } else if (selectedTimePeriod === 'WEEK') {
        start = dates.subtract(end, 12, 'week')
      } else if (selectedTimePeriod === 'DAY') {
        start = dates.subtract(end, 30, 'day')
      }

      const trends = await getTrends(props.selectedLabel.id, selectedTimePeriod, start, end)
      setTrends(trends)
    }
  }

  function renderTimePeriodSelections() {
    return (
      <div className="ml-2 field has-addons">
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
      </div>
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
    const data = {
      labels: trends.labels,
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
      <Center width="80%">
        <Box>
          <Text fontWeight="medium">No labels</Text>
          <Text fontSize="sm">Add labels to your events to view your trends.</Text>
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
