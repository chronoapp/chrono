import React from 'react'

import { Text, Flex, Tag, TagLabel, TagCloseButton } from '@chakra-ui/react'

import CircularProgress from '@material-ui/core/CircularProgress'

interface IProps {
  title: string
  showSpinner: boolean
  Icon?: any
  onClose: () => void
}

/**
 * Small toast that uses tags.
 */
export function ToastTag(props: IProps) {
  return (
    <Tag pr="3" pl="3" variant="solid" className="has-background-grey has-text-white-bis">
      <TagLabel>
        <Flex alignItems="center">
          {props.showSpinner && <CircularProgress size={'1rem'} className="has-text-white-ter" />}
          {props.Icon && <props.Icon className="has-text-grey-light" />}
          <Text fontWeight="normal">{props.title}</Text>
        </Flex>
      </TagLabel>

      {props.onClose && <TagCloseButton onClick={props.onClose} />}
    </Tag>
  )
}
