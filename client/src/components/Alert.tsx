import React from 'react'

import { FiX } from 'react-icons/fi'
import { IoIosCheckmarkCircle } from 'react-icons/io'
import { Icon, IconButton, Flex, Text } from '@chakra-ui/react'

interface IProps {
  title: string
  details?: string
  colorScheme: string
  onClose: () => void
}

const BaseAlert = (props: IProps) => {
  return (
    <Flex
      direction="row"
      justifyContent="left"
      bgColor={`${props.colorScheme}.50`}
      borderColor={`${props.colorScheme}.200`}
      borderRadius="sm"
      boxShadow={'lg'}
    >
      <Flex justifyContent={'space-between'} direction="row" w="100%">
        <Flex py="3.5" pl="4" direction="row" alignItems={'center'} justifyContent="center">
          <Icon w="6" h="6" color="green.500" as={IoIosCheckmarkCircle} />
          <Flex pl="3" direction="column">
            <Text as="h4" fontSize="md" fontWeight="600" color={`gray.800`}>
              {props.title}
            </Text>
            {props.details && (
              <Text fontSize="sm" color={`gray.700`}>
                {props.details}
              </Text>
            )}
          </Flex>
        </Flex>

        <IconButton
          size="sm"
          variant="ghost"
          aria-label="close alert"
          icon={<FiX />}
          onClick={props.onClose}
        />
      </Flex>
    </Flex>
  )
}

export const InfoAlert = (props: Omit<IProps, 'colorScheme'>) => {
  return <BaseAlert {...props} colorScheme="gray" />
}
