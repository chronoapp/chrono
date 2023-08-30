import React from 'react'
import clsx from 'clsx'

import { BsBarChartFill } from 'react-icons/bs'
import { LuContact } from 'react-icons/lu'

import {
  Box,
  Text,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react'

import Trends from '@/plugins/Trends'
import People from '@/plugins/People'

import * as API from '@/util/Api'

type PluginType = 'Trends' | 'People'

interface Plugin {
  name: string
  type: PluginType
  Icon: React.ComponentType<any>
  Component: React.ComponentType<any>
}

const PluginList: Record<PluginType, Plugin> = {
  Trends: {
    name: 'Trends',
    type: 'Trends',
    Icon: BsBarChartFill,
    Component: Trends,
  },
  People: {
    name: 'People',
    type: 'People',
    Icon: LuContact,
    Component: People,
  },
}

export default function Plugins() {
  const [viewPlugin, setViewPlugin] = React.useState<PluginType | null>(null)

  function renderPluginView() {
    if (!viewPlugin) {
      return null
    }

    const plugin = PluginList[viewPlugin]

    return (
      <Modal
        isOpen={true}
        onClose={() => {
          setViewPlugin(null)
        }}
        size="4xl"
      >
        <ModalOverlay />

        <ModalContent margin={0} top="5vh">
          <ModalHeader>{plugin.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <plugin.Component />
          </ModalBody>
        </ModalContent>
      </Modal>
    )
  }

  return (
    <Flex
      width="14"
      justifyContent="center"
      p="1"
      pt="2"
      flexShrink={0}
      borderLeftWidth="1px"
      borderColor="gray.200"
    >
      <Flex direction={'column'}>
        {Object.values(PluginList).map((plugin) => (
          <Box
            key={plugin.type}
            onClick={() => setViewPlugin(plugin.type)}
            mt={1}
            p="1"
            lineHeight="0.8"
            height="max-content"
            borderRadius="md"
            className={clsx('cal-plugin-icon', viewPlugin === plugin.type && 'cal-plugin-active')}
          >
            <Flex direction="column" align="center" color="gray.400">
              <plugin.Icon size={25} />
              <Text
                fontWeight="normal"
                fontSize="xs"
                color={`${viewPlugin === plugin.type ? 'gray.600' : 'gray.500'}`}
                mt="1"
              >
                {plugin.name}
              </Text>
            </Flex>
          </Box>
        ))}
      </Flex>

      {renderPluginView()}
    </Flex>
  )
}
