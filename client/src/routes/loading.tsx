import { Image, Box, Flex, Text } from '@chakra-ui/react'

import ChronoLogo from '@/assets/chrono.svg'

export function LoadingScreen() {
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
