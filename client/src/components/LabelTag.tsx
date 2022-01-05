import React from 'react'
import { Box, Flex, Text, Tag, TagCloseButton, TagLabel } from '@chakra-ui/react'
import tinycolor from 'tinycolor2'

import clsx from 'clsx'
import { Label } from '../models/Label'

interface LabelTagColorProps {
  colorHex: string
  lighten: boolean
  onClick?: () => void
  title?: string
  style?
}
export function LabelTagColor(props: LabelTagColorProps) {
  let color = props.colorHex

  let style = { backgroundColor: color, opacity: props.lighten ? 0.4 : 1 }
  if (props.style) {
    style = { ...style, ...props.style }
  }

  return (
    <Box
      onClick={props.onClick}
      title={props.title}
      style={style}
      className={clsx('event-label')}
    />
  )
}

LabelTagColor.defaultProps = {
  lighten: false,
}

interface LabelTagProps {
  label: Label
  variant: 'outline' | 'icon'
  classNames?: string
  onClickDelete?: (e) => void
}

export function LabelTag(props: LabelTagProps) {
  if (props.variant === 'icon') {
    return <LabelTagWithIcon {...props} />
  } else {
    return <LabelTagOutline {...props} />
  }
}

LabelTag.defaultProps = {
  variant: 'outline',
}

export function LabelTagWithIcon(props: LabelTagProps) {
  return (
    <Flex
      bg="gray.100"
      color="gray.600"
      alignItems="center"
      borderRadius="sm"
      pl="2"
      pr="2"
      mr="2"
      className={clsx(props.onClickDelete && 'pr-0', props.classNames && props.classNames)}
    >
      <LabelTagColor colorHex={props.label.color_hex} />
      <Text fontSize="sm" pl="1">
        {props.label.title}
      </Text>

      {props.onClickDelete && (
        <Tag size={'md'} borderRadius="sm" pl="0">
          <TagCloseButton onClick={(e) => props.onClickDelete && props.onClickDelete(e)} />
        </Tag>
      )}
    </Flex>
  )
}

function LabelTagOutline(props: LabelTagProps) {
  const color = tinycolor(props.label.color_hex).getLuminance() < 0.5 ? 'white' : '#4a4a4a'
  return (
    <Flex
      pr="2"
      mr="2"
      className={clsx(props.onClickDelete && 'pr-0', props.classNames && props.classNames)}
    >
      <Tag size={'sm'} borderRadius="md" bgColor={props.label.color_hex} color={color}>
        <TagLabel>#{props.label.title}</TagLabel>
        {props.onClickDelete && (
          <TagCloseButton onClick={(e) => props.onClickDelete && props.onClickDelete(e)} />
        )}
      </Tag>
    </Flex>
  )
}
