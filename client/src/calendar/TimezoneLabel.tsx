import React from 'react'
import { DateTime } from 'luxon'
import { Box } from '@chakra-ui/react'

const TimezoneLabel = () => {
  const timezoneOffset = DateTime.local().offset / 60

  // Format the timezone as GMT+/-X
  const formatTimezone = (offset) => {
    // If the offset is 0, it means it's GMT
    if (offset === 0) return 'GMT'

    const sign = offset < 0 ? '-' : '+'
    return `GMT${sign}${Math.abs(offset)}`
  }

  return <Box position="absolute">{formatTimezone(timezoneOffset)}</Box>
}

export default TimezoneLabel
