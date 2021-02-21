import React from 'react'
import { Flex, Text, Tag, TagCloseButton } from '@chakra-ui/react'

import clsx from 'clsx'
import { Label } from '../models/Label'

interface LabelTagColorProps {
  colorHex: string
  lighten: boolean
  title?: string
  style?
}
export function LabelTagColor(props: LabelTagColorProps) {
  let color = props.colorHex

  let style = { backgroundColor: color, opacity: props.lighten ? 0.4 : 1 }
  if (props.style) {
    style = { ...style, ...props.style }
  }

  return <div title={props.title} style={style} className={clsx('event-label-small')} />
}

LabelTagColor.defaultProps = {
  lighten: false,
}

interface LabelTagProps {
  label: Label
  allowEdit: boolean
  classNames?: string
  onClickDelete?: (e) => void
}

export function LabelTag(props: LabelTagProps) {
  return (
    <Flex
      bg="gray.100"
      color="gray.600"
      alignItems="center"
      borderRadius="sm"
      pl="2"
      pr="2"
      mr="2"
      className={clsx(props.allowEdit && 'pr-0', props.classNames && props.classNames)}
    >
      <LabelTagColor colorHex={props.label.color_hex} />
      <Text fontSize="sm" pl="1">
        {props.label.title}
      </Text>

      {props.allowEdit && (
        <Tag size={'md'} borderRadius="sm" pl="0">
          <TagCloseButton onClick={(e) => props.onClickDelete && props.onClickDelete(e)} />
        </Tag>
      )}
    </Flex>
  )
}
