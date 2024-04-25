import React, { forwardRef } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { ZonedDateTime, ZoneId } from '@js-joda/core'
import '@js-joda/timezone'

/**
 * Component designed to display the current timezone in a formatted string
 */
interface TimezoneLabelProps {
  gutterWidth: string | number
}

const TimezoneLabel = forwardRef<HTMLDivElement, TimezoneLabelProps>(({ gutterWidth }, ref) => {
  const now = ZonedDateTime.now(ZoneId.systemDefault())

  const timezoneOffset = now.offset().totalSeconds() / 3600
  /**
   * Formats the time to append either GMT -/+ at the end.
   */
  const formatTimezone = (offset) => {
    // If the offset is 0, it means it's GMT
    if (offset === 0) return 'GMT'

    const sign = offset < 0 ? '-' : '+'
    return `GMT${sign}${Math.abs(offset)}`
  }

  return (
    <Flex
      ref={ref}
      height="20px"
      alignItems="center"
      justifyContent="center"
      borderRadius="sm"
      p="1px"
      mx="1px"
    >
      <Text width={gutterWidth} fontSize="9px">
        {formatTimezone(timezoneOffset)}
      </Text>
    </Flex>
  )
})

export default TimezoneLabel
