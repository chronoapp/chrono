import React from 'react'
import Link from 'next/link'
import { Box, Text, Flex } from '@chakra-ui/react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { BsBarChartFill } from 'react-icons/bs'

export default function Plugins() {
  const router = useRouter()
  const isTrendsActive = router.pathname == '/trends'

  return (
    <Flex className="cal-plugins" justifyContent="center" pt="2">
      <Link href="/trends">
        <Box
          p="1"
          lineHeight="0.8"
          height="max-content"
          borderRadius="md"
          className={clsx('cal-plugin-icon', isTrendsActive && 'cal-plugin-active')}
        >
          <Flex direction="column" align="center" color="gray.400">
            <BsBarChartFill size={25} />
            <Text
              fontWeight="normal"
              fontSize="xs"
              color={`${isTrendsActive ? 'gray.600' : 'gray.500'}`}
              mt="1"
            >
              Trends
            </Text>
          </Flex>
        </Box>
      </Link>
    </Flex>
  )
}
