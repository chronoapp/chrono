import React, { forwardRef } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { ZonedDateTime, ZoneId } from '@js-joda/core'
import '@js-joda/timezone'

interface TimezoneLabelProps {
  id: string
  gutterWidth: string | number
}

const TimezoneLabel = forwardRef<HTMLDivElement, TimezoneLabelProps>(({ id, gutterWidth }, ref) => {
  const now = ZonedDateTime.now(ZoneId.systemDefault())

  const timezoneOffset = now.offset().totalSeconds() / 3600

  // Format the timezone as GMT+/-X
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
      bg="gray.200"
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
