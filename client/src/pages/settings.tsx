import React from 'react'
import { Text, Container } from '@chakra-ui/react'

import Layout from '../components/Layout'

function Settings() {
  return (
    <Layout canCreateEvent={true} includeLeftPanel={false}>
      <Container maxW="4xl" textAlign="left" mt="4">
        <Text fontWeight="medium" fontSize="2xl">
          Settings
        </Text>
        <Text>Customize your calendar settings.</Text>
      </Container>
    </Layout>
  )
}

export default Settings
