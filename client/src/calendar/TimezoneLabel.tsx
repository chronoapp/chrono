import React, { forwardRef } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { ZonedDateTime, ZoneId } from '@js-joda/core'
import '@js-joda/timezone'

/**
 * Component designed to display the current timezone in a formatted string.
 */
interface TimezoneLabelProps {
  gutterWidth: string | number
  timezone: { id: number; timezoneId: string }
}

const TimezoneLabel = forwardRef<HTMLDivElement, TimezoneLabelProps>(
  ({ gutterWidth, timezone }, ref) => {
    // Create a ZonedDateTime using the provided timezone ID
    const now = ZonedDateTime.now(ZoneId.of(timezone.timezoneId))

    // Calculate timezone offset in hours from GMT
    const timezoneOffset = now.offset().totalSeconds() / 3600

    /**
     * Formats the time to append either GMT -/+ at the end.
     */
    const formatTimezone = (offset) => {
      if (offset === 0) return 'GMT'

      const sign = offset < 0 ? '-' : '+'
      const hourOffset = Math.abs(offset)

      return `GMT${sign}${hourOffset}`
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
        backgroundColor="gray.100"
        title={`Timezone: ${timezone.timezoneId}`}
      >
        <Text width={gutterWidth} fontSize="9px" textAlign="center">
          {formatTimezone(timezoneOffset)}
        </Text>
      </Flex>
    )
  }
)

export default TimezoneLabel
