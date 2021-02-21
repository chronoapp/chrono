import React from 'react'
import { Flex, Box, Text, Button, Menu, MenuButton, MenuList } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import { Label } from '@/models/Label'
import LabelTree from '@/components/LabelTree'

interface IProps {
  labelsById: Record<number, Label>
  selectedLabel?: Label
  onSelectLabel: (label: Label) => void
}

/**
 * Dropdown to select labels from the label tree.
 * TODO: Handle empty labels.
 */
export default function TagDropdown(props: IProps) {
  const allLabels = Object.values(props.labelsById)
  const label = props.selectedLabel ? props.selectedLabel : allLabels[0]

  if (!label) {
    return <Box></Box>
  }

  return (
    <Menu>
      {({ onClose }) => (
        <>
          <MenuButton
            ml="2"
            mr="2"
            borderRadius="xs"
            size="sm"
            variant="outline"
            as={Button}
            rightIcon={<FiChevronDown />}
            fontWeight="normal"
          >
            <Flex>
              <Box className="event-label" bg={label.color_hex}></Box>
              <Text ml="2">{label.title}</Text>
            </Flex>
          </MenuButton>

          <MenuList pl="1">
            <LabelTree
              allowEdit={false}
              onSelect={(label) => {
                props.onSelectLabel(label)
                onClose()
              }}
            />
          </MenuList>
        </>
      )}
    </Menu>
  )
}
