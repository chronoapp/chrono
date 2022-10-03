import React from 'react'

import { RenderProps, Text, Flex, Tag, TagLabel, TagCloseButton } from '@chakra-ui/react'

import CircularProgress from '@material-ui/core/CircularProgress'

interface IProps extends RenderProps {
  title: string
  showSpinner: boolean
  Icon?: any
}

/**
 * Small toast that uses tags.
 */
export function ToastTag(props: IProps) {
  return (
    <Tag
      size={'lg'}
      pr="3"
      pl="3"
      variant="solid"
      className="has-background-grey has-text-white-bis"
    >
      <TagLabel>
        <Flex alignItems="center">
          {props.showSpinner && (
            <CircularProgress size={'1rem'} className="mr-1 has-text-white-ter" />
          )}
          {props.Icon && <props.Icon className="has-text-grey-light mr-1" />}
          <Text fontWeight="normal">{props.title}</Text>
        </Flex>
      </TagLabel>

      {props.onClose && <TagCloseButton onClick={props.onClose} />}
    </Tag>
  )
}
