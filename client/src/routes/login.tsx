import React from 'react'
import { FormControl, FormLabel, Input, Flex, Box, Button, Text, Image } from '@chakra-ui/react'
import Cookies from 'universal-cookie'

import * as dates from '@/util/dates'
import { getGoogleOauthUrl, getMsftOauthUrl, loginWithEmail } from '@/util/Api'

import MicrosoftLogo from '@/assets/microsoft-logo.png'
import GoogleLogo from '@/assets/google.svg'
import ChronoLogo from '@/assets/chrono.svg'

const COOKIE_EXPIRE_DAYS = 30

/**
 * TODO: Redirect to home if already logged in.
 */
function Login() {
  const [email, setEmail] = React.useState<string>('')
  const [password, setPassword] = React.useState<string>('')

  return (
    <Box width="400px" position="fixed" top="30%" left="50%" transform="translate(-50%, -30%)">
      <Flex alignItems="center" justifyContent="center">
        <Image src={ChronoLogo} alt="Chrono logo" boxSize={'5em'} />
      </Flex>
      <Box boxShadow="lg" padding="5">
        <Text textAlign="center" mt="2" fontSize="lg">
          Sign in to Chrono
        </Text>

        <Button
          mt="4"
          variant="outline"
          w="100%"
          onClick={() => (window.location.href = getGoogleOauthUrl())}
        >
          <img src={GoogleLogo} style={{ width: '40px', paddingRight: 5 }}></img> Continue with
          Google
        </Button>

        <Button
          variant="outline"
          mt="2"
          w="100%"
          onClick={() => (window.location.href = getMsftOauthUrl())}
        >
          <img src={MicrosoftLogo.src} style={{ width: '32px', paddingRight: 5 }}></img> Continue
          with Microsoft
        </Button>

        <hr />

        <Text textAlign="center" color="gray.500" mt="4">
          Or, sign in with email
        </Text>

        <FormControl id="calendar-description" mt="2">
          <FormLabel>Email</FormLabel>
          <Input
            className="input"
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
            }}
          />
        </FormControl>
        <FormControl id="calendar-description" mt="2">
          <FormLabel>Password</FormLabel>
          <Input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
          />
        </FormControl>

        <Button
          colorScheme="blue"
          w="100%"
          mt="2"
          onClick={async () => {
            const resp = await loginWithEmail(email, password)

            const cookies = new Cookies()
            cookies.set('auth_token', resp.token, {
              expires: dates.add(Date.now(), COOKIE_EXPIRE_DAYS, 'day'),
            })
            window.location.replace('/')
          }}
        >
          Sign in
        </Button>
      </Box>
    </Box>
  )
}

export default Login
