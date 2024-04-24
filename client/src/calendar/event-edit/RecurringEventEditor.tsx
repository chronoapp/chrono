import { useState, useEffect } from 'react'
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
  RadioGroup,
  Stack,
  Radio,
  Input,
  Divider,
} from '@chakra-ui/react'

import { ZonedDateTime as DateTime, ChronoUnit } from '@js-joda/core'
import produce from 'immer'
import { BsArrowRepeat } from 'react-icons/bs'
import { FiChevronDown } from 'react-icons/fi'

import { userState } from '@/state/UserState'
import * as dates from '@/util/dates-joda'

import {
  formatFullDay,
  formatDayOfWeekNumeric,
  formatTwoLetterWeekday,
  getWeekRange,
  localFullDate,
  toJsDate,
  fromJsDate,
} from '@/util/localizer-joda'

import { Frequency as RRuleFreq, RRule, RRuleSet, Weekday, rrulestr, Options } from 'rrule'

enum EndCondition {
  Never,
  ByCount,
  ByEndDate,
}

interface IProps {
  initialDate: DateTime
  initialRulestr: string | null
  onChange?: (rule: RRule | undefined) => void
}

/**
 * The default options for a recurring event when we have just
 * opened the recurring event editor.
 */
function getDefaultOptions(initialDate: DateTime) {
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
export function getRecurrenceRules(rulestr: string, initialDate: DateTime): Partial<Options> {
  const ruleset = rrulestr(rulestr, { forceset: true }) as RRuleSet

  const rules = ruleset.rrules()
  if (rules.length !== 1) {
    return getDefaultOptions(initialDate)
  }

  const firstRule = rules[0].origOptions

  return firstRule
}

/**
 * Cleans up options (cannot set both until and count) and returns a valid RRule
 * depending on the end condition.
 */
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

function getInitialEndCondition(recurrence: Partial<Options>): EndCondition {
  if (recurrence.count) {
    return EndCondition.ByCount
  } else if (recurrence.until) {
    return EndCondition.ByEndDate
  } else {
    return EndCondition.Never
  }
}

function getInitialOptions(initialRuleStr: string | null, initialDate: DateTime) {
  if (initialRuleStr) {
    return getRecurrenceRules(initialRuleStr, initialDate)
  } else {
    return getDefaultOptions(initialDate)
  }
}

/**
 * UI that encapsulates the creation of an RRULE. Tightly coupled with the rrule
 * library since it uses its internals.
 *
 * The input recurrences string (e.g. RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TH,TU)
 * is decontructed to the recurringOptions dict.
 *
 * TODO: Support Nth weekday in month
 * - byweekday: RRule.FR.nth(2),
 */
function RecurringEventEditor(props: IProps) {
  const [modalEnabled, setModalEnabled] = useState<boolean>(false)
  const [recurringOptions, setRecurringOptions] = useState<Partial<Options>>(
    getInitialOptions(props.initialRulestr, props.initialDate)
  )

  const [endCondition, setEndCondition] = useState<EndCondition>(
    getInitialEndCondition(recurringOptions)
  )
  const [isRecurring, setIsRecurring] = useState<boolean>(props.initialRulestr !== null)

  const weekRange = getWeekRange(DateTime.now())
  const rule: RRule | undefined = getRRule(recurringOptions, endCondition)

  /**
   * Updates the end conditions when the recurrence frequency changes.
   */
  useEffect(() => {
    if (modalEnabled) {
      switch (recurringOptions.freq) {
        case RRuleFreq.DAILY:
          setRecurringOptions({
            ...recurringOptions,
            until: toJsDate(dates.add(props.initialDate, 30, ChronoUnit.DAYS)),
            count: 30,
            byweekday: [],
          })
          break
        case RRuleFreq.WEEKLY:
          const dayNo = formatDayOfWeekNumeric(props.initialDate)
          setRecurringOptions({
            ...recurringOptions,
            until: toJsDate(dates.add(props.initialDate, 13, ChronoUnit.WEEKS)),
            count: 13,
            byweekday: [new Weekday(dayNo)],
          })
          break
        case RRuleFreq.MONTHLY:
          setRecurringOptions({
            ...recurringOptions,
            until: toJsDate(dates.add(props.initialDate, 12, ChronoUnit.MONTHS)),
            count: 12,
            byweekday: [],
          })
          break
        case RRuleFreq.YEARLY:
          setRecurringOptions({
            ...recurringOptions,
            until: toJsDate(dates.add(props.initialDate, 5, ChronoUnit.YEARS)),
            count: 5,
            byweekday: [],
          })
          break
        default:
          break
      }
    }
  }, [recurringOptions.freq, modalEnabled])

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

  /**
   * Renders the dropdown that allows the user to select the frequency of the recurring event.
   */
  function renderFrequencySelection() {
    return (
      <Flex alignItems="center" className="control">
        <Text size="sm" mr="1">
          Repeat every
        </Text>

        <NumberInput
          size="xs"
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
          size="xs"
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
    )
  }

  function renderRangeSelection() {
    if (recurringOptions.freq === RRuleFreq.WEEKLY) {
      let weekdays: number[] = []
      if (recurringOptions.byweekday && Array.isArray(recurringOptions.byweekday)) {
        weekdays = recurringOptions.byweekday.map((day) => day['weekday'])
      }

      return (
        <Box mt="4">
          <Text size="sm">On</Text>

          <Flex mt="1">
            {weekRange.map((day, idx) => {
              const dayNumber = (formatDayOfWeekNumeric(day) + 6) % 7
              const isSelected = weekdays.includes(dayNumber)

              return (
                <Flex
                  key={idx}
                  justifyContent="center"
                  alignItems={'center'}
                  mt="1"
                  ml="1"
                  w="2em"
                  h="2em"
                  p="0.25em"
                  cursor="pointer"
                  borderRadius={'xl'}
                  border="1px"
                  borderStyle={'solid'}
                  borderColor={'gray.200'}
                  backgroundColor={isSelected ? 'blue.500' : 'white'}
                  boxShadow="sm"
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
                  <Text fontSize="2xs" color={isSelected ? 'white' : 'gray.700'}>
                    {formatTwoLetterWeekday(day)}
                  </Text>
                </Flex>
              )
            })}
          </Flex>
        </Box>
      )
    }
  }

  /**
   * Select when the recurring event ends. Could be a date or after a number of occurences.
   */
  function renderEndSelection() {
    return (
      <Box mt="4">
        <Text size="sm">Ends</Text>

        <RadioGroup
          mt="1"
          fontSize={'sm'}
          onChange={(val) => {
            setEndCondition(parseInt(val) as EndCondition)
          }}
          value={endCondition.toString()}
        >
          <Stack direction="column">
            <Radio value={EndCondition.Never.toString()}>
              <Text fontSize={'sm'}>Never</Text>
            </Radio>

            {recurringOptions.until && (
              <Radio value={EndCondition.ByEndDate.toString()}>
                <Flex alignItems={'center'}>
                  <Text fontSize={'sm'} mr="1">
                    On
                  </Text>
                  <Input
                    size="xs"
                    type="date"
                    isDisabled={endCondition != EndCondition.ByEndDate}
                    value={formatFullDay(fromJsDate(recurringOptions.until))}
                    onChange={(e) => {
                      setRecurringOptions({
                        ...recurringOptions,
                        until: toJsDate(localFullDate(e.target.value)),
                      })
                    }}
                  />
                </Flex>
              </Radio>
            )}

            <Radio value={EndCondition.ByCount.toString()}>
              <Flex alignItems="center">
                <Text fontSize={'sm'} mr="1">
                  After
                </Text>
                <NumberInput
                  size="xs"
                  ml="1"
                  min={1}
                  max={99}
                  value={recurringOptions?.count || ''}
                  isDisabled={endCondition != EndCondition.ByCount}
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
                <Text ml="1" size={'sm'}>
                  times
                </Text>
              </Flex>
            </Radio>
          </Stack>
        </RadioGroup>
      </Box>
    )
  }

  function renderRecurringEventModal() {
    if (!modalEnabled) {
      return
    }

    return (
      <Modal
        isOpen={modalEnabled}
        onClose={() => setModalEnabled(false)}
        blockScrollOnMount={false}
        size="xs"
      >
        <ModalOverlay />
        <ModalContent pt="4" fontSize={'sm'}>
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
        {renderFrequencySelection()}
        {renderRangeSelection()}
        {renderEndSelection()}
        <Divider mt="4" />
        <Text mt="3" color={'gray.700'}>
          {rule ? `Repeats ${rule.toText()}` : 'Does not repeat'}
        </Text>
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
          variant="ghost"
        >
          {selectedRule ? `Repeats ${selectedRule.toText()}` : 'Does not repeat'}{' '}
        </MenuButton>

        <MenuList mt="-1">
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(false)
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
            }}
          >
            Monthly
          </MenuItem>
          <MenuDivider m="0" />
          <MenuItem
            fontSize="sm"
            onClick={() => {
              setIsRecurring(true)
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
      <Flex mt="2" alignItems="center">
        <Box mr="2">
          <BsArrowRepeat size={'1em'} />
        </Box>
        {renderDropdownMenu()}
      </Flex>
      {renderRecurringEventModal()}
    </>
  )
}

export default RecurringEventEditor
