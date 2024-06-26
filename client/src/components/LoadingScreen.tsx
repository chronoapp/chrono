import ChronoLogo from '@/assets/chrono.svg'
import { Image, Box, Flex, Text } from '@chakra-ui/react'

import { Oval } from 'react-loader-spinner'

export default function LoadingScreen(props: { loadingText?: string }) {
  return (
    <Box position="fixed" top="40%" left="50%" transform="translate(-50%, -40%)">
      <Flex alignItems="center" justifyContent="center" direction="column">
        <Image src={ChronoLogo} alt="Chrono logo" boxSize={'5em'} mb="4" />
        <Oval
          visible={true}
          height="30"
          width="30"
          strokeWidth="4"
          color="#BDBDBD"
          secondaryColor="#D9D9D9"
        />
      </Flex>
      {props.loadingText && (
        <Text fontSize={'sm'} mt="2">
          {props.loadingText}
        </Text>
      )}
    </Box>
  )
}
