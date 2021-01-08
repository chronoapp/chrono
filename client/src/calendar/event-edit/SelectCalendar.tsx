import React from 'react'

import Select from 'react-select'
import Calendar from '../../models/Calendar'

interface IProps {
  calendarsById: Record<number, Calendar>
  defaultCalendarId: string
  onChange: (value: string) => void
}

export default function SelectCalendar(props: IProps) {
  const calendarValues = Object.values(props.calendarsById)
    .filter((cal) => cal.isWritable())
    .map((calendar) => {
      return {
        value: calendar.id,
        label: calendar.summary,
        color: calendar.backgroundColor,
      }
    })

  const dot = (color = '#ccc') => ({
    alignItems: 'center',
    display: 'flex',

    ':before': {
      backgroundColor: color,
      borderRadius: 3,
      content: '" "',
      display: 'block',
      marginRight: 5,
      marginLeft: 5,
      height: 12,
      width: 12,
    },
  })

  const customStyles = {
    option: (styles, { data }) => ({ ...styles, ...dot(data.color), height: 30 }),
    container: (styles) => ({ ...styles, minWidth: '14em' }),
    singleValue: (styles, { data }) => ({ ...styles, ...dot(data.color) }),
    control: (provided, state) => ({
      ...provided,
      border: 0,
      minHeight: 30,
      height: 30,
      boxShadow: state.isFocused ? null : null,
    }),
    valueContainer: (provided, state) => ({
      ...provided,
      height: 30,
      padding: '0 6px',
    }),
    input: (provided, state) => ({
      ...provided,
      margin: '0px',
    }),
    indicatorSeparator: (state) => ({
      display: 'none',
    }),
    indicatorsContainer: (provided, state) => ({
      ...provided,
      height: 30,
    }),
  }

  const defaultCal = props.calendarsById[props.defaultCalendarId]
  const defaultValue = {
    value: defaultCal.id,
    label: defaultCal.summary,
    color: defaultCal.backgroundColor,
  }

  return (
    <Select
      defaultValue={defaultValue}
      options={calendarValues}
      styles={customStyles}
      onChange={({ value }) => props.onChange(value)}
    />
  )
}
