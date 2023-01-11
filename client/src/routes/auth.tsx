import React from 'react'
import { Image, Box, Flex, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

import useQuery from '@/lib/hooks/useQuery'
import { setLocalStorageItem } from '@/lib/local-storage'

import { authenticate } from '@/util/Api'
import * as dates from '@/util/dates'

import ChronoLogo from '@/assets/chrono.svg'
import NProgress from 'nprogress'

/**
 * Callback after Oauth redirect.
 */
function Auth() {
  const query = useQuery()
  const navigate = useNavigate()

  NProgress.configure({ showSpinner: false })
  NProgress.start()

  React.useEffect(() => {
    validateTokenAndRedirect()
  }, [])

  async function validateTokenAndRedirect() {
    const code = query.get('code')
    const state = query.get('state')

    if (!code || !state) {
      navigate('/login')
    } else {
      const resp = await authenticate(code, state)
      const tokenData = {
        token: resp.token,
        expires: dates.add(Date.now(), 30, 'day'),
      }
      setLocalStorageItem('auth_token', tokenData)
    }

    setTimeout(() => {
      NProgress.done()
      navigate('/')
    }, 500)
  }

  return (
    <Box position="fixed" top="30%" left="50%" transform="translate(-50%, -30%)">
      <Flex alignItems="center" justifyContent="center" direction="column">
        <Image src={ChronoLogo} alt="Chrono logo" boxSize={'5em'} />
        <Text fontWeight={'medium'} fontSize={'sm'} color={'gray.600'} mt="1em">
          Setting up your calendar..
        </Text>
      </Flex>
    </Box>
  )
}

export default Auth
