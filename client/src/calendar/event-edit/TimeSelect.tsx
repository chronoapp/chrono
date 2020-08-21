import React, { useContext, useState } from 'react'
import Select from 'react-select'

import { format } from '../../util/localizer'
import * as dates from '../../util/dates'

interface IProps {
  start: Date
  end: Date
  onSelectStartDate: (date: Date) => void
  onSelectEndDate: (date: Date) => void
}

const INTERVAL = 15

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
    const option = { value: idx, label: format(endDate, 'h:mm A') }
    endTimeOptions.push(option)
    idx += 1
  }

  const customStyles = {
    option: (provided, state) => ({
      ...provided,
      fontSize: '0.75rem',
    }),
    singleValue: (provided, state) => {
      return { ...provided, marginLeft: 'auto', marginRight: 'auto' }
    },
    container: (provided, state) => {
      return { ...provided, fontSize: '0.8rem', zIndex: 5 }
    },
  }

  return (
    <div className="cal-time-select-wrapper">
      <Select
        components={{ IndicatorSeparator: () => null }}
        styles={customStyles}
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
        styles={customStyles}
        className="cal-date-select"
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
