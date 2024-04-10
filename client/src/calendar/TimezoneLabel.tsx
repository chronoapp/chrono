import { Flex, Text } from '@chakra-ui/react'
import { DateTime } from 'luxon'

const TimezoneLabel = ({ gutterWidth }) => {
  const timezoneOffset = DateTime.local().offset / 60

  // Format the timezone as GMT+/-X
  const formatTimezone = (offset) => {
    // If the offset is 0, it means it's GMT
    if (offset === 0) return 'GMT'

    const sign = offset < 0 ? '-' : '+'
    return `GMT${sign}${Math.abs(offset)}`
  }

  return (
    <Flex
      height="20px"
      alignItems="center"
      justifyContent="center"
      borderRadius="sm"
      bg="gray.200"
      p="1px"
      mx="1px"
      mb="10px"
    >
      <Text width={gutterWidth} fontSize="9px">
        {formatTimezone(timezoneOffset)}
      </Text>
    </Flex>
  )
}

export default TimezoneLabel
