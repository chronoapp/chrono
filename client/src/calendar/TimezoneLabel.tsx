import React, { forwardRef } from 'react'
import { Flex, Text } from '@chakra-ui/react'
import { DateTime } from 'luxon'

interface TimezoneLabelProps {
  id: string
  gutterWidth: string | number
}

const TimezoneLabel = forwardRef<HTMLDivElement, TimezoneLabelProps>(({ id, gutterWidth }, ref) => {
  const timezoneOffset = DateTime.local().offset / 60

  // Format the timezone as GMT+/-X
  const formatTimezone = (offset) => {
    // If the offset is 0, it means it's GMT
    if (offset === 0) return 'GMT'

    const sign = offset < 0 ? '-' : '+'
    return `GMT${sign}${Math.abs(offset)}${id}`
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
