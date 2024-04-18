import { Container, Flex, Box, Button, Text, Link } from '@chakra-ui/react'

import { FaShield } from 'react-icons/fa6'
import { FiCalendar } from 'react-icons/fi'
import { LuContact } from 'react-icons/lu'

import { getGoogleOauthUrl } from '@/util/Api'

/**
 * Page that warns about the necessary permissions needed to use the app.
 */
export default function Permissions() {
  return (
    <Container>
      <Flex direction="column" align="center" justify="center" height="100vh">
        <Box as={FaShield} size="60" color="#BDBDBD" />
        <Text fontSize="xl" fontWeight={'bold'} textAlign="center" mt="2">
          Allow Permissions
        </Text>

        <Text textAlign="center" mt="3">
          Chrono needs a few permissions to give you the best experience. We take your{' '}
          <Link href="https://www.rechrono.com/privacy-policy">privacy</Link>. seriously and will
          not share any personal data.
        </Text>

        <Box boxShadow={'md'} mt="8" mb="8" p="6">
          <Flex>
            <Box as={FiCalendar} size="20" flexShrink={0} />
            <Text ml="2" fontSize="sm">
              We need calendar access to sync with your Google Calendar
            </Text>
          </Flex>

          <Flex mt="2">
            <Box as={LuContact} size="20" flexShrink={0} />

            <Text ml="2" fontSize="sm">
              We need contacts access to auto-complete when adding guests to events and to see time
              spent with the important people in your life.
            </Text>
          </Flex>
        </Box>

        <Button
          mt="4"
          pl="8"
          pr="8"
          pt="4"
          pb="4"
          variant="outline"
          onClick={() => (window.location.href = getGoogleOauthUrl('sign_in'))}
        >
          <Text fontSize="sm" fontWeight="medium">
            Continue
          </Text>
        </Button>
      </Flex>
    </Container>
  )
}
