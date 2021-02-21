import React from 'react'
import clsx from 'clsx'
import { Container, Center, Flex, Box, Text } from '@chakra-ui/react'
import { Bar } from 'react-chartjs-2'

import * as dates from '@/util/dates'
import { getTrends, getAuthToken } from '@/util/Api'
import { Label, TimePeriod } from '@/models/Label'
import { LabelContext } from '@/components/LabelsContext'

import ViewSelector, { TrendView } from './ViewSelector'
import TagDropdown from './TagDropdown'

interface IProps {
  authToken: string
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
  const labelsContext = React.useContext(LabelContext)

  React.useEffect(() => {
    updateTrendsData()
  }, [])

  React.useEffect(() => {
    updateTrendsData()
  }, [selectedTimePeriod, props.selectedLabel])

  async function updateTrendsData() {
    const authToken = getAuthToken()

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

      const trends = await getTrends(
        props.selectedLabel.id,
        authToken,
        selectedTimePeriod,
        start,
        end
      )
      setTrends(trends)
    }
  }

  function renderTimePeriodSelections() {
    return (
      <div className="ml-2 field has-addons">
        <button
          onClick={() => setSelectedTimePeriod('DAY')}
          className={clsx(
            'button',
            'button-underline',
            'is-small',
            selectedTimePeriod === 'DAY' && 'is-active'
          )}
        >
          Day
        </button>
        <button
          onClick={() => setSelectedTimePeriod('WEEK')}
          className={clsx(
            'button',
            'button-underline',
            'ml-1',
            'is-small',
            selectedTimePeriod === 'WEEK' && 'is-active'
          )}
        >
          Week
        </button>
        <button
          onClick={() => setSelectedTimePeriod('MONTH')}
          className={clsx(
            'button',
            'button-underline',
            'ml-1',
            'is-small',
            selectedTimePeriod === 'MONTH' && 'is-active'
          )}
        >
          Month
        </button>
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
          <Text fontSize="xl">No labels</Text>
          <Text>Add labels to your events to view your trends.</Text>
        </Box>
      </Center>
    )
  }

  const { labelState } = labelsContext

  if (!labelState.loading && Object.keys(labelState.labelsById).length == 0) {
    return renderEmpty()
  } else {
    return (
      <Container minW="3xl" maxW="5xl" mt="2">
        <Flex justifyContent="space-between">
          <Flex ml="2" alignItems="center" justifyContent="flex-start">
            <Text>Time spent on</Text>
            {
              <TagDropdown
                labelsById={labelState.labelsById}
                selectedLabel={props.selectedLabel}
                onSelectLabel={(label) => props.setSelectedLabel(label)}
              />
            }
            <Text>per</Text>
            {renderTimePeriodSelections()}
          </Flex>

          <ViewSelector setSelectedView={props.setSelectedView} selectedView={'CHART'} />
        </Flex>

        <Box mt="2">{renderChart(labelState.labelsById)}</Box>
      </Container>
    )
  }
}

export default TrendChart
