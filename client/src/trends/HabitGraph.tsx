import React, { useState, useEffect, useContext } from 'react'
import chunk from 'lodash/chunk'
import clsx from 'clsx'

import ViewSelector, { TrendView } from './ViewSelector'
import { Label, TimePeriod } from '../models/Label'
import { startOfWeek, format, getWeekRange } from '../util/localizer'
import { LabelContext } from '../components/LabelsContext'

import { hexToHSL } from '../calendar/utils/Colors'
import * as dates from '../util/dates'
import { getTrends, getAuthToken } from '../util/Api'

interface IProps {
  setSelectedView: (v: TrendView) => void
}

function HabitGraph(props: IProps) {
  const [trendMap, setTrendMap] = useState<Map<string, number>>(undefined!)
  const [maxDuration, setMaxDuration] = useState(0)

  const labelsContext = useContext(LabelContext)
  const viewDate = new Date()
  const month = dates.visibleDays(viewDate, startOfWeek(), true)
  const weeks = chunk(month, 7)

  const [selectedLabel, setSelectedLabel] = useState<Label>(getSelectedLabel())

  useEffect(() => {
    updateTrendsData()
  }, [])

  async function updateTrendsData() {
    const authToken = getAuthToken()
    const start = dates.firstVisibleDay(viewDate, startOfWeek())
    const end = dates.lastVisibleDay(viewDate, startOfWeek())
    const trends = await getTrends(selectedLabel.id, authToken, 'DAY', start, end)

    const trendMap = new Map<string, number>()
    for (let i = 0; i < trends.labels.length; i++) {
      trendMap.set(trends.labels[i], trends.values[i])
    }
    const maxDuration = Math.max(...trends.values)
    console.log(maxDuration)
    setMaxDuration(maxDuration)
    setTrendMap(trendMap)
  }

  function getSelectedLabel() {
    return labelsContext.labelState.labelsById[16]
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
    const { h, s, l } = hexToHSL(selectedLabel.color_hex)

    return (
      <div key={idx} className="cal-mini-month-row">
        {week.map((day: Date, idx: number) => {
          const label = format(day, 'D')
          const dayKey = format(day, 'YYYY-MM-DD')
          const dayValue = trendMap.get(dayKey)

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
      </div>
    )
  }

  function renderGraph() {
    if (!trendMap) {
      return
    }

    return (
      <div>
        <div className="cal-mini-month-row">{renderHeader()}</div>
        {weeks.map(renderWeek)}
      </div>
    )
  }

  return (
    <div className="container mt-2">
      <div className="has-text-weight-semibold">
        <div className="level">
          <div className="level-left">Habit Chart</div>
          <ViewSelector setSelectedView={props.setSelectedView} selectedView={'HABIT_GRAPH'} />
        </div>
      </div>

      <div className="card-content">{renderGraph()}</div>
    </div>
  )
}

export default HabitGraph
