import React from 'react'
import { Menu, MenuButton, MenuList, Button, Flex } from '@chakra-ui/react'
import { FiPlus } from 'react-icons/fi'
import LabelTree from '@/components/LabelTree'
import produce from 'immer'

const TagDropdown = ({ eventFields, setEventFields }) => {
  return (
    <Menu isLazy>
      {({ onClose }) => (
        <>
          <MenuButton
            borderRadius="xs"
            size="sm"
            fontWeight="normal"
            fontSize="sm"
            as={Button}
            variant="link"
            justifyContent="center"
            alignItems="center"
          >
            <Flex align="center">
              <FiPlus /> add tag
            </Flex>
          </MenuButton>

          <MenuList pl="1" fontSize={'sm'}>
            <LabelTree
              allowEdit={false}
              onSelect={(label) => {
                const updatedLabels = produce(eventFields.labels, (draft) => {
                  if (!draft.find((l) => l.id === label.id)) {
                    draft.push(label)
                  }
                })

                setEventFields({ ...eventFields, labels: updatedLabels })
                onClose()
              }}
            />
          </MenuList>
        </>
      )}
    </Menu>
  )
}

export default TagDropdown
