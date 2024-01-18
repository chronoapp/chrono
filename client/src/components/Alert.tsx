import { FiX } from 'react-icons/fi'
import { IoIosCheckmarkCircle, IoIosInformationCircle } from 'react-icons/io'
import { Icon, IconButton, Flex, Text } from '@chakra-ui/react'

type AlertIcon = 'info' | 'success'

interface IProps {
  title: string
  colorScheme: string
  details?: string
  icon?: AlertIcon
  onClose?: () => void
}

const BaseAlert = (props: IProps) => {
  const alertIcon = props.icon === 'info' ? IoIosInformationCircle : IoIosCheckmarkCircle
  const alertColor = props.icon === 'info' ? 'gray.500' : 'green.500'

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
          <Icon w="6" h="6" color={alertColor} as={alertIcon} />
          <Flex pl="3" direction="column">
            <Text as="h4" fontSize="sm" fontWeight="600" color={`gray.800`}>
              {props.title}
            </Text>
            {props.details && (
              <Text fontSize="xs" color={`gray.700`}>
                {props.details}
              </Text>
            )}
          </Flex>
        </Flex>

        {props.onClose && (
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="close alert"
            icon={<FiX />}
            onClick={props.onClose}
          />
        )}
      </Flex>
    </Flex>
  )
}

BaseAlert.defaultProps = {
  colorScheme: 'gray',
  icon: 'success',
}

export const InfoAlert = (props: Omit<IProps, 'colorScheme'>) => {
  return <BaseAlert {...props} colorScheme="gray" />
}
