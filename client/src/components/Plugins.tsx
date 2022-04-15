import React from 'react'
import { useRouter } from 'next/router'

import clsx from 'clsx'
import { BsBarChartFill } from 'react-icons/bs'
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
import * as API from '@/util/Api'

type PluginType = 'Trends'

export default function Plugins() {
  const router = useRouter()
  const [viewPlugin, setViewPlugin] = React.useState<PluginType | null>(null)

  function renderPluginView() {
    if (!viewPlugin) {
      return null
    }

    return (
      <Modal
        isOpen={true}
        onClose={() => {
          setViewPlugin(null)
        }}
        size="5xl"
      >
        <ModalOverlay />

        <ModalContent height="90vh" margin={0} top="5vh">
          <ModalHeader>Trends</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Trends authToken={API.getAuthToken()} />
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
      <Box
        onClick={() => setViewPlugin('Trends')}
        p="1"
        lineHeight="0.8"
        height="max-content"
        borderRadius="md"
        className={clsx('cal-plugin-icon', viewPlugin === 'Trends' && 'cal-plugin-active')}
      >
        <Flex direction="column" align="center" color="gray.400">
          <BsBarChartFill size={25} />
          <Text
            fontWeight="normal"
            fontSize="xs"
            color={`${viewPlugin === 'Trends' ? 'gray.600' : 'gray.500'}`}
            mt="1"
          >
            Trends
          </Text>
        </Flex>
      </Box>

      {renderPluginView()}
    </Flex>
  )
}
