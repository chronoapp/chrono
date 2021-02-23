import React from 'react'
import { Text, Container, Heading } from '@chakra-ui/react'

import Layout from '@/components/Layout'

function Settings() {
  return (
    <Layout canCreateEvent={true} includeLeftPanel={false}>
      <Container maxW="4xl" textAlign="left" mt="4">
        <Heading>Settings</Heading>
        <Text fontSize="lg">Customize your calendar settings.</Text>
      </Container>
    </Layout>
  )
}

export default Settings
