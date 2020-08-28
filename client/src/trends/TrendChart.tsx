import React, { useState, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import clsx from 'clsx'

import Icon from '@mdi/react'
import { mdiChevronDown } from '@mdi/js'

import * as dates from '../util/dates'
import { getTrends, getAuthToken } from '../util/Api'
import { Label, TimePeriod } from '../models/Label'
import { LabelContext } from '../components/LabelsContext'
import ViewSelector, { TrendView } from './ViewSelector'

interface IProps {
  authToken: string
  setSelectedView: (view: TrendView) => void
}

/**
 * List of trends.
 */
function TrendChart(props: IProps) {
  const [timespanDropdownActive, setTimespanDropdownActive] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null)
  const [trends, setTrends] = useState<any>({})
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<TimePeriod>('WEEK')

  useEffect(() => {
    updateTrendsData()
  }, [])

  useEffect(() => {
    updateTrendsData()
  }, [selectedTimePeriod, selectedLabel])

  async function updateTrendsData() {
    const authToken = getAuthToken()

    if (selectedLabel) {
      const end = new Date()
      let start

      if (selectedTimePeriod === 'MONTH') {
        start = dates.subtract(end, 12, 'month')
      } else if (selectedTimePeriod === 'WEEK') {
        start = dates.subtract(end, 12, 'week')
      } else if (selectedTimePeriod === 'DAY') {
        start = dates.subtract(end, 30, 'day')
      }

      console.log(start)
      console.log(end)

      const trends = await getTrends(selectedLabel.id, authToken, selectedTimePeriod, start, end)
      setTrends(trends)
    }
  }

  function renderTagDropdown(labelsById: Record<number, Label>) {
    const allLabels = Object.values(labelsById)
    const label = selectedLabel ? selectedLabel : allLabels[0]

    if (!label) {
      return
    }

    return (
      <div
        className={clsx(
          'ml-2 mr-2 dropdown',
          'is-hoverable',
          timespanDropdownActive && 'is-active'
        )}
      >
        <div onClick={() => console.log('dropdown')} className="dropdown-trigger">
          <button className="button" aria-haspopup="true" aria-controls="dropdown-menu">
            <span
              className="event-label"
              style={{ backgroundColor: label.color_hex, display: 'inline-block' }}
            ></span>
            <span className="ml-1">{label.title}</span>
            <Icon path={mdiChevronDown} size={1}></Icon>
          </button>
        </div>
        <div className="dropdown-menu" id="dropdown-menu" role="menu">
          <div className="dropdown-content">
            {allLabels.map((l) => {
              return (
                <a
                  key={l.id}
                  className="dropdown-item"
                  style={{ textAlign: 'left' }}
                  onClick={() => setSelectedLabel(l)}
                >
                  <span
                    className="event-label"
                    style={{ backgroundColor: l.color_hex, display: 'inline-block' }}
                  ></span>
                  <span className="ml-1">{l.title}</span>
                </a>
              )
            })}
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
          className={clsx('button', 'is-small', selectedTimePeriod === 'DAY' && 'is-active')}
        >
          Day
        </button>
        <button
          onClick={() => setSelectedTimePeriod('WEEK')}
          className={clsx(
            'button',
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

    const label = selectedLabel ? selectedLabel : Object.values(labels)[0]
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
            <div className="container mt-2">
              <div className="has-text-weight-semibold">
                <div className="level">
                  <div className="level-left">
                    Time spent on {renderTagDropdown(labelsById)} per {renderTimePeriodSelections()}
                  </div>

                  <ViewSelector setSelectedView={props.setSelectedView} selectedView={'CHART'} />
                </div>
              </div>

              <div className="card-content">{renderChart(labelsById)}</div>
            </div>
          )
        }
      }}
    </LabelContext.Consumer>
  )
}

export default TrendChart
