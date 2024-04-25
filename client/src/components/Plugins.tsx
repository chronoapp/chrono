import React from 'react'
import clsx from 'clsx'
import { useRecoilValue } from 'recoil'

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

import { userState } from '@/state/UserState'

type PluginType = 'Trends' | 'People'

interface Plugin {
  name: string
  type: PluginType
  Icon: React.ComponentType<any>
  Component: React.ComponentType<any>
}

const initialList: Plugin[] = [
  {
    name: 'People',
    type: 'People',
    Icon: LuContact,
    Component: People,
  },
]

export default function Plugins() {
  const user = useRecoilValue(userState)
  const [viewPlugin, setViewPlugin] = React.useState<PluginType | null>(null)

  let pluginList: Plugin[] = initialList

  if (!user?.flags.DISABLE_TAGS) {
    const trendsPlugin = {
      name: 'Trends',
      type: 'Trends',
      Icon: BsBarChartFill,
      Component: Trends,
    }
    pluginList = initialList.concat(trendsPlugin as Plugin)
  }

  function renderPluginView() {
    if (!viewPlugin) {
      return null
    }

    const plugin = pluginList.find((plugin) => plugin.type === viewPlugin)!

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
          <ModalHeader>{plugin?.name}</ModalHeader>
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
      borderTopEndRadius={'sm'}
      borderBottomEndRadius={'sm'}
      bgColor={'white'}
    >
      <Flex direction={'column'}>
        {pluginList.map((plugin) => (
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
