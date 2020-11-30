import React from 'react'
import SelectStyles from './SelectStyles'
import Select from 'react-select'

interface IProps {
  days: number
  startDate: Date
  onSelectNumDays: (days: number) => void
}

const MAX_DAYS = 5

function TimeSelectFullDay(props: IProps) {
  const options: { value: number; label: string }[] = []

  for (let i = 1; i < MAX_DAYS + 1; i++) {
    options.push({ value: i, label: `${i} day${i > 1 ? 's' : ''}` })
  }

  return (
    <Select
      components={{ IndicatorSeparator: () => null }}
      styles={SelectStyles}
      name="start-date"
      className="cal-date-select"
      value={options[props.days - 1]}
      onChange={({ value }) => {
        props.onSelectNumDays(value)
      }}
      options={options}
    />
  )
}

export default TimeSelectFullDay
