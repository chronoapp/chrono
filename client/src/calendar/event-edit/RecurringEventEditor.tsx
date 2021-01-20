import React, { useState, useEffect } from 'react'
import clsx from 'clsx'

import * as dates from '../../util/dates'
import { format, getWeekRange, localFullDate } from '../../util/localizer'
import { Frequency as RRuleFreq, RRule, RRuleSet, rrulestr } from 'rrule'

type Frequency = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
enum EndCondition {
  Never,
  ByCount,
  ByEndDate,
}

interface IProps {
  initialDate: Date
  onChange?: (rule: RRule) => void
}

/**
 * UI to create a RRULE.
 *
 * TODO: Allow default rule options.
 * Days in week.
 * - byweekday: [RRule.MO, RRule.FR],
 * - bymonthday: [1,2..]
 *
 * Nth weekday in month
 * - byweekday: RRule.FR.nth(2),
 */
function RecurringEventEditor(props: IProps) {
  const [frequency, setFrequency] = useState<Frequency>('WEEK')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [interval, setInterval] = useState<number>(1)
  const [occurrences, setOccurrences] = useState<number>(1)
  const [endDate, setEndDate] = useState<Date>()
  const [endCondition, setEndCondition] = useState<EndCondition>(EndCondition.Never)

  const weekRange = getWeekRange(new Date())
  const rule = getRRule()

  useEffect(() => {
    if (frequency == 'DAY') {
      setSelectedDays(weekRange.map((day, idx) => idx))
      setEndDate(dates.add(props.initialDate, 1, 'day'))
    } else if (frequency == 'WEEK') {
      setSelectedDays([parseInt(format(props.initialDate, 'd'))])
      setEndDate(dates.add(props.initialDate, 1, 'week'))
    } else if (frequency == 'MONTH') {
      setSelectedDays([])
      setEndDate(dates.add(props.initialDate, 1, 'month'))
    }
  }, [frequency])

  useEffect(() => {
    props.onChange && props.onChange(rule)
  }, [rule])

  function getRRule() {
    const rruleParams = {
      freq: convertFrequency(frequency),
      interval: interval,
      dtstart: props.initialDate,
    }

    if (endCondition == EndCondition.ByCount) {
      rruleParams['count'] = occurrences
    } else if (endCondition == EndCondition.ByEndDate) {
      rruleParams['until'] = endDate
    }

    return new RRule(rruleParams)
  }

  function convertFrequency(f: Frequency): RRuleFreq {
    if (f == 'DAY') {
      return RRuleFreq.DAILY
    } else if (f == 'WEEK') {
      return RRuleFreq.WEEKLY
    } else if (f == 'MONTH') {
      return RRuleFreq.MONTHLY
    } else if (f == 'YEAR') {
      return RRuleFreq.YEARLY
    } else {
      throw new Error(`Invalid Frequency ${f}`)
    }
  }

  function renderRangeSelection() {
    if (frequency == 'WEEK') {
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

  function onEndConditionChange(e) {
    const condition = e.target.value as EndCondition
    setEndCondition(condition)
  }

  function renderEndSelection() {
    return (
      <div className="mt-3">
        Ends on
        <div className="control mt-2 is-flex is-flex-direction-column">
          <label className="radio is-flex is-align-items-center">
            <input
              type="radio"
              name="date"
              checked={endCondition == EndCondition.Never}
              onChange={onEndConditionChange}
              value={EndCondition.Never}
            />
            <div className="ml-1">Never</div>
          </label>

          <label className="radio is-flex is-align-items-center mt-1 ml-0">
            <input
              type="radio"
              name="date"
              checked={endCondition == EndCondition.ByEndDate}
              onChange={onEndConditionChange}
              value={EndCondition.ByEndDate}
            />
            <div className="ml-1">Date</div>
            <input
              className="input is-small ml-1"
              type="date"
              disabled={endCondition != EndCondition.ByEndDate}
              value={format(endDate, 'YYYY-MM-DD')}
              onChange={(e) => {
                const endDate = localFullDate(e.target.value)
                setEndDate(endDate)
              }}
            ></input>
          </label>

          <label className="radio is-flex is-align-items-center mt-1 ml-0">
            <input
              type="radio"
              name="occurences"
              checked={endCondition == EndCondition.ByCount}
              value={EndCondition.ByCount}
              onChange={onEndConditionChange}
            />
            <div className="ml-1">After</div>

            <div className="is-flex is-align-items-center">
              <input
                className="input is-small ml-1"
                type="number"
                min="1"
                max="99"
                value={occurrences}
                disabled={endCondition != EndCondition.ByCount}
                style={{ maxWidth: 45 }}
                onChange={(e) => {
                  setOccurrences(parseInt(e.target.value))
                }}
              ></input>
              <span className="ml-1">Occurences</span>
            </div>
          </label>
        </div>
      </div>
    )
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
          value={interval}
          style={{ maxWidth: 50 }}
          onChange={(e) => {
            setInterval(parseInt(e.target.value))
          }}
        ></input>

        <span className="select is-small">
          <select
            defaultValue={frequency}
            onChange={(val) => setFrequency(val.target.value as Frequency)}
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
      <div className="mt-3">Repeats {rule.toText()}</div>
    </div>
  )
}

export default RecurringEventEditor
