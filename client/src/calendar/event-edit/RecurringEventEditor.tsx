import React, { useState, useEffect } from 'react'
import clsx from 'clsx'

import { format, getWeekRange } from '../../util/localizer'

type Frequency = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

const frequencyNames = {
  NONE: 'Does not repeat',
  DAY: 'Daily',
  WEEK: 'Weekly',
  MONTH: 'Monthly',
  YEAR: 'Yearly',
}

/**
 * UI to create a RRULE.
 */
function RecurringEventEditor(props: { initialDate: Date }) {
  const [repeats, setRepeats] = useState<Frequency>('WEEK')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [counter, setCounter] = useState<number>(1)

  const weekRange = getWeekRange(new Date())

  useEffect(() => {
    console.log('useEffect')
    if (repeats == 'DAY') {
      setSelectedDays(weekRange.map((day, idx) => idx))
    } else if (repeats == 'WEEK') {
      setSelectedDays([parseInt(format(props.initialDate, 'd'))])
    } else {
      setSelectedDays([])
    }
  }, [repeats])

  function renderRangeSelection() {
    if (repeats === 'DAY' || repeats == 'WEEK') {
      return (
        <div className="mt-3 has-text-grey-lighter recurring-days">
          {weekRange.map((day, idx) => {
            const dayNumber = parseInt(format(day, 'd'))
            const isSelected = selectedDays.includes(dayNumber)
            return (
              <span
                key={idx}
                className={clsx('recurring-day ml-1', isSelected && 'selected')}
                onClick={() => {
                  if (isSelected) {
                    setSelectedDays((prevState) => prevState.filter((x) => x !== dayNumber))
                  } else {
                    setSelectedDays((prevState) => [...prevState, dayNumber])
                  }
                }}
              >
                <span>{format(day, 'dd')[0]}</span>
              </span>
            )
          })}
        </div>
      )
    }
  }

  function renderEndSelection() {
    return (
      <div className="mt-3">
        Ends on
        <div className="control mt-2 is-flex is-flex-direction-column">
          <label className="radio is-flex is-align-items-center">
            <input type="radio" name="answer" />
            <div className="ml-1">Date</div>
          </label>
          <label className="radio is-flex is-align-items-center mt-1 ml-0">
            <input type="radio" name="answer" />
            <div className="ml-1">After</div>

            <div className="is-flex is-align-items-center">
              <input
                className="input is-small ml-1"
                type="number"
                min="1"
                max="99"
                value={counter}
                style={{ maxWidth: 45 }}
                onChange={(e) => {}}
              ></input>
              <span className="ml-1">Occurences</span>
            </div>
          </label>
        </div>
      </div>
    )
  }

  function renderDescription() {
    let description = `Repeats ${frequencyNames[repeats].toLowerCase()}`

    return <div className="mt-3">{description}</div>
  }

  return (
    <div>
      <div className="control is-flex is-align-items-center">
        <label className="mr-1">Repeat every</label>
        <input
          className="input is-small mr-1"
          type="number"
          min="1"
          max="99"
          value={counter}
          style={{ maxWidth: 50 }}
          onChange={(e) => {
            setCounter(parseInt(e.target.value))
          }}
        ></input>

        <span className="select is-small">
          <select
            defaultValue={repeats}
            onChange={(val) => setRepeats(val.target.value as Frequency)}
          >
            {['DAY', 'WEEK', 'MONTH', 'YEAR'].map((val, idx) => {
              return (
                <option key={idx} value={val}>
                  {val.toLowerCase()}
                </option>
              )
            })}
          </select>
        </span>
      </div>

      {renderRangeSelection()}
      {renderEndSelection()}

      <hr />
      {renderDescription()}
    </div>
  )
}

export default RecurringEventEditor
