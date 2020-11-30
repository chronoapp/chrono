import React, { useContext, useState } from 'react'
import Select from 'react-select'
import SelectStyles from './SelectStyles'

import { format } from '../../util/localizer'
import * as dates from '../../util/dates'

interface IProps {
  start: Date
  end: Date
  onSelectStartDate: (date: Date) => void
  onSelectEndDate: (date: Date) => void
}

const INTERVAL = 15

export function formatDuration(duration: number) {
  if (duration <= dates.MILLI.hours) {
    return `${duration / dates.MILLI.minutes} m`
  }

  const hours = duration / dates.MILLI.hours
  return `${hours}h`
}

/**
 * Renders the start and end time selectors.
 */
function TimeSelect(props: IProps) {
  const dayStart: Date = dates.startOf(props.start, 'day')
  const dayEnd: Date = dates.endOf(props.start, 'day')

  const startIdx = Math.round(dates.diff(dayStart, props.start, 'minutes') / INTERVAL) + 1
  const startTimeOptions: { value: number; label: string }[] = []

  let startDate: Date = dayStart
  let idx = 0
  while (dates.gt(dayEnd, startDate)) {
    const option = { value: idx, label: format(startDate, 'h:mm A') }
    startTimeOptions.push(option)
    startDate = dates.add(dayStart, INTERVAL * idx, 'minutes')
    idx += 1
  }

  const endIdx = Math.round(dates.diff(props.end, props.start, 'minutes') / INTERVAL) - 1
  const endTimeOptions: { value: number; label: string }[] = []
  let endDate: Date = props.start
  idx = 0
  while (dates.gt(dayEnd, endDate)) {
    endDate = dates.add(endDate, INTERVAL, 'minutes')
    const label = `${format(endDate, 'h:mm A')}`
    const option = { value: idx, label: label }
    endTimeOptions.push(option)
    idx += 1
  }

  return (
    <div className="cal-time-select-wrapper ml-1">
      <Select
        components={{ IndicatorSeparator: () => null }}
        styles={SelectStyles}
        name="start-date"
        className="cal-date-select"
        value={startTimeOptions[startIdx]}
        onChange={({ value }) => {
          console.log(value)
          const date = dates.add(dayStart, (value - 1) * INTERVAL, 'minutes')
          props.onSelectStartDate(date)
        }}
        options={startTimeOptions}
      />
      <Select
        components={{ IndicatorSeparator: () => null }}
        styles={SelectStyles}
        className="cal-date-select ml-1"
        value={endTimeOptions[endIdx]}
        onChange={({ value }) => {
          const date = dates.add(props.start, (value + 1) * INTERVAL, 'minutes')
          props.onSelectEndDate(date)
        }}
        options={endTimeOptions}
      />
    </div>
  )
}

export default TimeSelect
