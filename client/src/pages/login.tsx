import React from 'react'
import { FormControl, FormLabel, Input, Flex, Box, Button, Text } from '@chakra-ui/react'

import { getGoogleOauthUrl, getMsftOauthUrl } from '../util/Api'

/**
 * TODO: Redirect to home if already logged in.
 */
function Login() {
  return (
    <div
      style={{
        width: '400px',
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -30%)',
      }}
    >
      <Flex justifyContent="center">
        <img src={'./timecouncil-logo-250.jpg'} style={{ width: '15em' }} />
      </Flex>
      <Box boxShadow="lg" padding="5">
        <Text textAlign="center" mt="2">
          Sign in to Timecouncil
        </Text>

        <br />

        <Button
          variant="outline"
          w="100%"
          onClick={() => (window.location.href = getGoogleOauthUrl())}
        >
          <img src={'./google.svg'} style={{ width: '40px', paddingRight: 5 }}></img> Continue with
          Google
        </Button>

        <Button
          variant="outline"
          mt="2"
          w="100%"
          onClick={() => (window.location.href = getMsftOauthUrl())}
        >
          <img src={'./microsoft-logo.png'} style={{ width: '32px', paddingRight: 5 }}></img>{' '}
          Continue with Microsoft
        </Button>

        <hr />

        <Text textAlign="center" color="gray.500" mt="2">
          Or, sign in with email
        </Text>

        <FormControl id="calendar-description" mt="2">
          <FormLabel>Email</FormLabel>
          <Input className="input" type="text" placeholder="Email" />
        </FormControl>
        <FormControl id="calendar-description" mt="2">
          <FormLabel>Password</FormLabel>
          <Input className="input" type="password" placeholder="Password" />
        </FormControl>

        <Button colorScheme="blue" w="100%" mt="2">
          Sign in
        </Button>
      </Box>
    </div>
  )
}

export default Login
