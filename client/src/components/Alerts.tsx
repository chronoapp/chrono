import React, { useContext } from 'react'
import { Text, Flex, Tag, TagLabel, TagCloseButton } from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

import CircularProgress from '@material-ui/core/CircularProgress'

import { AlertsContext } from '../components/AlertsContext'

export function Alerts() {
  const alertContext = useContext(AlertsContext)
  const alert = alertContext.getAlert()

  return (
    <div className="global-alert">
      {alert && (
        <Tag
          size={'lg'}
          pr="3"
          pl="3"
          variant="solid"
          className="has-background-grey has-text-white-bis"
        >
          <TagLabel>
            <Flex alignItems="center">
              {alert.isLoading && (
                <CircularProgress size={'1rem'} className="mr-1 has-text-white-ter" />
              )}
              {alert.icon && <alert.icon className="has-text-grey-light mr-1" />}
              <Text fontWeight="normal">{alert.title}</Text>
            </Flex>
          </TagLabel>

          <TagCloseButton onClick={() => alertContext.removeAlert(alert)}>
            <FiX size={1} style={{ cursor: 'pointer' }} />
          </TagCloseButton>
        </Tag>
      )}
    </div>
  )
}
