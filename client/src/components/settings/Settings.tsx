import React, { useState } from 'react'
import { Flex, Box, Text, Button, Container, Heading } from '@chakra-ui/react'

import GeneralSettings from '@/components/settings/GeneralSettings'
import ProfileSettings from '@/components/settings/ProfileSettings'

type SettingsTab = 'calendar' | 'profile'

function SettingsButton(props: { selected: boolean; text: string; onSelect: () => void }) {
  return (
    <Button
      onClick={() => props.onSelect()}
      variant={'unstyled'}
      mt="0.5"
      textAlign={'left'}
      bgColor={props.selected ? 'gray.100' : 'transparent'}
    >
      <Text color={'gray.800'} ml="2">
        {props.text}
      </Text>
    </Button>
  )
}

function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('calendar')

  return (
    <Container maxW="4xl" minH={'2xl'} textAlign="left" mt="4">
      <Heading ml="2" size="md">
        Settings
      </Heading>

      <Flex direction={'row'} ml="2" mt="2">
        <Flex direction={'column'} mr="4" minW="36">
          <SettingsButton
            text="Calendar"
            onSelect={() => setActiveTab('calendar')}
            selected={activeTab == 'calendar'}
          />
          <SettingsButton
            text="Profile"
            onSelect={() => setActiveTab('profile')}
            selected={activeTab == 'profile'}
          />
        </Flex>

        <Box width="100%">
          {activeTab == 'calendar' && <GeneralSettings />}
          {activeTab == 'profile' && <ProfileSettings />}
        </Box>
      </Flex>
    </Container>
  )
}

export default Settings
