import React from 'react'
import Link from 'next/link'
import { Box, Flex } from '@chakra-ui/react'
import { useRouter } from 'next/router'
import clsx from 'clsx'
import { BsBarChartFill } from 'react-icons/bs'

export default function Plugins() {
  const router = useRouter()

  return (
    <div className="cal-plugins is-flex is-justify-content-center">
      <div
        className={clsx(
          'cal-plugin-icon mt-2 is-flex-direction-column',
          router.pathname == '/trends' && 'cal-plugin-active'
        )}
      >
        <Link href="/trends">
          <Box>
            <Flex justifyContent="center">
              <BsBarChartFill size={25} className="has-text-grey-light" />
            </Flex>
            <span className="cal-plugin-text is-size-7 has-text-grey">Trends</span>
          </Box>
        </Link>
      </div>
    </div>
  )
}
