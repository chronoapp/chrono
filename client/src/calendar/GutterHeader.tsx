import { IconButton, Flex } from '@chakra-ui/react'
import { FiPlus } from 'react-icons/fi'

const GutterHeader = ({ addGutter, width, headerHeight }) => {
  function ToogleAdditionalTimezone({ addGutter }) {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="adding additional timezones"
        icon={<FiPlus />}
        onClick={() => addGutter()}
        width="4"
      />
    )
  }

  return (
    <Flex
      className="rbc-label cal-time-header-gutter"
      width={width}
      height={headerHeight}
      direction={'column'}
      justifyContent={'flex-start'}
      alignItems={'center'}
      position="sticky"
      left="0"
      background-color="white"
      z-index="10"
      margin-right="-1px"
    >
      <ToogleAdditionalTimezone addGutter={addGutter} />
    </Flex>
  )
}

export default GutterHeader
