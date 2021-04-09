import React, { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  Button,
  Text,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
} from '@chakra-ui/react'

import clsx from 'clsx'
import produce from 'immer'
import { BsArrowRepeat } from 'react-icons/bs'
import { FiChevronDown } from 'react-icons/fi'

import * as dates from '../../util/dates'
import { format, getWeekRange, localFullDate } from '../../util/localizer'
import { Frequency as RRuleFreq, RRule, RRuleSet, Weekday, rrulestr, Options } from 'rrule'

enum EndCondition {
  Never,
  ByCount,
  ByEndDate,
}

interface IProps {
  initialDate: Date
  initialRulestr: string | null
  onChange?: (rule: RRule | undefined) => void
}

function getDefaultOptions(initialDate: Date) {
  const defaultOptions = {
    freq: RRuleFreq.WEEKLY,
    interval: 1,
    byweekday: [new Weekday(0)],
  }
  return defaultOptions
}

/**
 * Get default rule parts from a recurrence string.
 */
export function getRecurrenceRules(rulestr: string, initialDate: Date): Partial<Options> {
  const ruleset = rrulestr(rulestr, { forceset: true }) as RRuleSet

  const rules = ruleset.rrules()
  if (rules.length !== 1) {
    return getDefaultOptions(initialDate)
  }

  const firstRule = rules[0].origOptions
  return firstRule
}

function getRRule(
  recurringOptions: Partial<Options>,
  endCondition: EndCondition
): RRule | undefined {
  if (endCondition == EndCondition.ByCount) {
    return new RRule(
      produce(recurringOptions, (d) => {
        delete d['until']
      })
    )
  } else if (endCondition == EndCondition.ByEndDate) {
    return new RRule(
      produce(recurringOptions, (d) => {
        delete d['count']
      })
    )
  } else {
    return new RRule(
      produce(recurringOptions, (d) => {
        delete d['count']
        delete d['until']
      })
    )
  }
}

/**
 * UI that encapsulates the creation of an RRULE.
 *
 * The input recurrences string (e.g. RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TH,TU)
 * is decontructed to the recurringOptions dict.
 *
 * TODO: Support Nth weekday in month
 * - byweekday: RRule.FR.nth(2),
 */
function RecurringEventEditor(props: IProps) {
  const [modalEnabled, setModalEnabled] = useState<boolean>(false)
  const [repeatingDropdownActive, setRepeatingDropdownActive] = useState<boolean>(false)
  const [recurringOptions, setRecurringOptions] = useState<Partial<Options>>(
    props.initialRulestr
      ? getRecurrenceRules(props.initialRulestr, props.initialDate)
      : getDefaultOptions(props.initialDate)
  )

  // TODO: set initial
  const [endCondition, setEndCondition] = useState<EndCondition>(EndCondition.Never)
  const [isRecurring, setIsRecurring] = useState<boolean>(props.initialRulestr !== null)

  const weekRange = getWeekRange(new Date())
  const rule: RRule | undefined = getRRule(recurringOptions, endCondition)

  /**
   * Updates the end conditions when the recurrence frequency changes.
   */
  useEffect(() => {
    if (modalEnabled) {
      if (recurringOptions?.freq == RRuleFreq.DAILY) {
        setRecurringOptions({
          ...recurringOptions,
          until: dates.add(props.initialDate, 1, 'day'),
          count: 1,
          byweekday: [],
        })
      } else if (recurringOptions?.freq == RRuleFreq.WEEKLY) {
        const dayNo = parseInt(format(props.initialDate, 'd'))
        const rruleDay = new Weekday(dayNo)

        setRecurringOptions({
          ...recurringOptions,
          until: dates.add(props.initialDate, 1, 'week'),
          count: 1,
          byweekday: [rruleDay],
        })
      } else if (recurringOptions?.freq == RRuleFreq.MONTHLY) {
        setRecurringOptions({
          ...recurringOptions,
          until: dates.add(props.initialDate, 1, 'month'),
          count: 1,
          byweekday: [],
        })
      }
    }
  }, [recurringOptions?.freq, modalEnabled])

  useEffect(() => {
    if (!modalEnabled) {
      if (isRecurring) {
        props.onChange && props.onChange(rule)
      } else {
        props.onChange && props.onChange(undefined)
      }
    }
  }, [recurringOptions, isRecurring, endCondition])

  function frequencyName(freq: RRuleFreq) {
    if (freq == RRuleFreq.DAILY) {
      return 'day'
    } else if (freq == RRuleFreq.WEEKLY) {
      return 'week'
    } else if (freq == RRuleFreq.MONTHLY) {
      return 'month'
    } else if (freq == RRuleFreq.YEARLY) {
      return 'year'
    } else {
      throw new Error(`Unsupported frequency ${freq}`)
    }
  }

  function onEndConditionChange(e) {
    const condition = e.target.value as EndCondition
    setEndCondition(condition)
  }

  /**
   * Select when the recurring event ends. Could be a date or after a number of occurences.
   */
  function renderEndSelection() {
    return (
      <Box mt="3" mb="2">
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
              value={recurringOptions?.until ? format(recurringOptions.until, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                setRecurringOptions({
                  ...recurringOptions,
                  until: localFullDate(e.target.value),
                })
              }}
            ></input>
          </label>

          <label className="radio is-flex is-align-items-center mt-1 ml-0">
            <input
              type="radio"
              name="occurrences"
              checked={endCondition == EndCondition.ByCount}
              value={EndCondition.ByCount}
              onChange={onEndConditionChange}
            />
            <div className="ml-1">After</div>

            <Flex alignItems="center">
              <NumberInput
                size="sm"
                ml="1"
                min={1}
                max={99}
                value={recurringOptions?.count || ''}
                disabled={endCondition != EndCondition.ByCount}
                w="20"
                onChange={(val) => {
                  setRecurringOptions({
                    ...recurringOptions,
                    count: parseInt(val),
                  })
                }}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <span className="ml-1">Occurrences</span>
            </Flex>
          </label>
        </div>
      </Box>
    )
  }

  function renderRangeSelection() {
    if (recurringOptions.freq === RRuleFreq.WEEKLY) {
      let weekdays: number[] = []
      if (recurringOptions.byweekday && Array.isArray(recurringOptions.byweekday)) {
        weekdays = recurringOptions.byweekday.map((day) => day['weekday'])
      }

      return (
        <Box mt="3" className="recurring-days">
          {weekRange.map((day, idx) => {
            const dayNumber = (parseInt(format(day, 'd')) + 6) % 7
            const isSelected = weekdays.includes(dayNumber)

            return (
              <span
                key={idx}
                className={clsx('recurring-day ml-1', isSelected && 'selected')}
                onClick={() => {
                  if (isSelected) {
                    setRecurringOptions((options) =>
                      produce(options, (draft) => {
                        if (draft.byweekday && Array.isArray(draft.byweekday)) {
                          draft.byweekday = draft.byweekday.filter(
                            (day) => day['weekday'] !== dayNumber
                          )
                        }
                      })
                    )
                  } else {
                    setRecurringOptions((options) =>
                      produce(options, (draft) => {
                        if (draft.byweekday && Array.isArray(draft.byweekday)) {
                          draft.byweekday.push(new Weekday(dayNumber))
                        }
                      })
                    )
                  }
                }}
              >
                <span>{format(day, 'dd')[0]}</span>
              </span>
            )
          })}
        </Box>
      )
    }
  }

  function renderRecurringEventModal() {
    if (!modalEnabled) {
      return
    }

    return (
      <Modal isOpen={modalEnabled} onClose={() => setModalEnabled(false)}>
        <ModalOverlay />
        <ModalContent pt="4">
          <ModalCloseButton />
          <ModalBody>
            {renderEditor()}

            <ModalFooter>
              <Button variant={'ghost'} mr={3} onClick={() => setModalEnabled(false)}>
                Cancel
              </Button>

              <Button
                onClick={() => {
                  setModalEnabled(false)
                  setIsRecurring(true)
                  props.onChange && props.onChange(rule)
                }}
              >
                Done
              </Button>
            </ModalFooter>
          </ModalBody>
        </ModalContent>
      </Modal>
    )
  }

  function renderEditor() {
    return (
      <Box>
        <Flex alignItems="center" className="control">
          <Text mr="1">Repeat every</Text>

          <NumberInput
            size="sm"
            min={1}
            max={99}
            value={recurringOptions?.interval}
            w="20"
            onChange={(val) => {
              setRecurringOptions({ ...recurringOptions, interval: parseInt(val) })
            }}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>

          <Select
            size="sm"
            w="30"
            ml="1"
            defaultValue={recurringOptions?.freq?.toString()}
            onChange={(e) => {
              setRecurringOptions({
                ...recurringOptions,
                freq: parseInt(e.target.value) as RRuleFreq,
              })
            }}
          >
            {[RRuleFreq.DAILY, RRuleFreq.WEEKLY, RRuleFreq.MONTHLY, RRuleFreq.YEARLY].map(
              (val, idx) => {
                return (
                  <option key={idx} value={val}>
                    {frequencyName(val)}
                  </option>
                )
              }
            )}
          </Select>
        </Flex>
        {renderRangeSelection()}
        {renderEndSelection()}

        <hr />
        <Box mt="3">{rule ? `Repeats ${rule.toText()}` : 'Does not repeat'}</Box>
      </Box>
    )
  }

  function renderDropdownMenu() {
    const selectedRule = props.initialRulestr
      ? getRRule(getRecurrenceRules(props.initialRulestr, props.initialDate), endCondition)
      : null

    return (
      <Menu>
        <MenuButton
          borderRadius="sm"
          size="sm"
          as={Button}
          rightIcon={<FiChevronDown />}
          fontWeight="normal"
        >
          {selectedRule ? `Repeats ${selectedRule.toText()}` : 'Does not repeat'}{' '}
        </MenuButton>

        <MenuList mt="-1">
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(false)
              setRepeatingDropdownActive(false)
            }}
          >
            Never
          </MenuItem>
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(true)
              setRecurringOptions({
                freq: RRuleFreq.DAILY,
                interval: 1,
              })
              setRepeatingDropdownActive(false)
            }}
          >
            Daily
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(true)
              setRecurringOptions({
                freq: RRuleFreq.WEEKLY,
                interval: 1,
              })
              setRepeatingDropdownActive(false)
            }}
          >
            Weekly
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(true)
              setRecurringOptions({
                freq: RRuleFreq.MONTHLY,
                interval: 1,
              })
              setRepeatingDropdownActive(false)
            }}
          >
            Monthly
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(true)
              setRepeatingDropdownActive(false)
              setModalEnabled(true)
            }}
          >
            Custom
          </MenuItem>
        </MenuList>
      </Menu>
    )
  }

  return (
    <>
      <div className="mt-2 is-flex is-align-items-center">
        <BsArrowRepeat className="mr-2" size={'1.25em'} />
        {renderDropdownMenu()}
      </div>
      {renderRecurringEventModal()}
    </>
  )
}

export default RecurringEventEditor
