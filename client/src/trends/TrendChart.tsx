import React, { useState, useEffect } from 'react'
import { Flex, Box } from '@chakra-ui/react'

import { Bar } from 'react-chartjs-2'
import { FiChevronDown } from 'react-icons/fi'
import clsx from 'clsx'

import * as dates from '../util/dates'
import { getTrends, getAuthToken } from '../util/Api'
import { Label, TimePeriod } from '../models/Label'
import { LabelContext } from '../components/LabelsContext'
import ViewSelector, { TrendView } from './ViewSelector'
import LabelTree from '../components/LabelTree'

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
  const [trends, setTrends] = useState<any>({})
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<TimePeriod>('WEEK')
  const [labelTreeExpanded, setLabelTreeExpanded] = useState<boolean>(false)

  useEffect(() => {
    updateTrendsData()
  }, [])

  useEffect(() => {
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

  function renderTagDropdown(labelsById: Record<number, Label>) {
    const allLabels = Object.values(labelsById)
    const label = props.selectedLabel ? props.selectedLabel : allLabels[0]

    if (!label) {
      return
    }

    return (
      <div className={clsx('ml-2 mr-2 dropdown', labelTreeExpanded && 'is-active')}>
        <div onClick={() => setLabelTreeExpanded(!labelTreeExpanded)} className="dropdown-trigger">
          <button
            className="button button-underline"
            aria-haspopup="true"
            aria-controls="dropdown-menu"
          >
            <span
              className="event-label"
              style={{ backgroundColor: label.color_hex, display: 'inline-block' }}
            ></span>
            <span className="ml-1">{label.title}</span>
            <FiChevronDown className="mt-1" />
          </button>
        </div>
        <div className="dropdown-menu" id="dropdown-menu" role="menu">
          <div className="dropdown-content">
            <LabelTree
              allowEdit={false}
              onSelect={(label) => {
                props.setSelectedLabel(label)
                setLabelTreeExpanded(false)
              }}
            />
          </div>
        </div>
      </div>
    )
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
      <div className="columns is-vcentered" style={{ width: '80%', height: '80%' }}>
        <div className="column">
          <h1 className="title">No labels</h1>
          <h1 className="subtitle">Add labels to your events to view trends!</h1>
        </div>
      </div>
    )
  }

  return (
    <LabelContext.Consumer>
      {({ labelState: { labelsById, loading } }) => {
        if (!loading && Object.keys(labelsById).length == 0) {
          return renderEmpty()
        } else {
          return (
            <Box centerContent className="container is-max-desktop" mt="2">
              <Flex justifyContent="space-between">
                <Flex ml="2" alignItems="center" justifyContent="flex-start">
                  Time spent on {renderTagDropdown(labelsById)} per {renderTimePeriodSelections()}
                </Flex>

                <ViewSelector setSelectedView={props.setSelectedView} selectedView={'CHART'} />
              </Flex>

              <Box mt="2">{renderChart(labelsById)}</Box>
            </Box>
          )
        }
      }}
    </LabelContext.Consumer>
  )
}

export default TrendChart
