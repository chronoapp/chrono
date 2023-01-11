import { Flex, Box, Button, Text, Image } from '@chakra-ui/react'

import { getGoogleOauthUrl } from '@/util/Api'

import GoogleLogo from '@/assets/google.svg'
import ChronoLogo from '@/assets/chrono.svg'

/**
 * TODO: Add link for TOS
 */
function SignUp() {
  return (
    <Box position="fixed" top="30%" left="50%" transform="translate(-50%, -30%)">
      <Flex alignItems="center" justifyContent="center">
        <Image src={ChronoLogo} alt="Chrono logo" boxSize={'4em'} />
      </Flex>
      <Flex padding="5" width="400px" direction={'column'} align={'center'}>
        <Text textAlign="center" mt="2" fontSize="18" fontWeight={'medium'}>
          Create your Chrono account
        </Text>

        <Button
          mt="4"
          p="2"
          pt="4"
          pb="4"
          variant="outline"
          w="100%"
          onClick={() => (window.location.href = getGoogleOauthUrl())}
        >
          <img src={GoogleLogo} style={{ width: '40px', paddingRight: 5 }}></img>
          <Text fontSize={'sm'} fontWeight={'medium'}>
            Continue with Google
          </Text>
        </Button>

        <Text color="gray.500" fontSize={'sm'} mt="8">
          By signing up, you agree to the Terms of Service.
        </Text>
      </Flex>
    </Box>
  )
}

export default SignUp
