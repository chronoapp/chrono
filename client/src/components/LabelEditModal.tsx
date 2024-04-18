import React from 'react'
import {
  Button,
  Text,
  Box,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react'
import { useToast, ToastId } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'

import { getSortedLabelColors, LabelColor } from '@/models/LabelColors'
import { EditingLabelState } from '@/state/LabelsState'
import { InfoAlert } from '@/components/Alert'

function EditLabelModal(props: {
  editingLabel: EditingLabelState
  onClickSaveLabel: (newLabelModal: EditingLabelState) => void
  onCloseModal: () => void
}) {
  const toast = useToast()
  const toastIdRef = React.useRef<ToastId>()

  const allColors = getSortedLabelColors()
  const [editingLabel, setEditingLabel] = React.useState<EditingLabelState>(props.editingLabel)
  const selectedColor = editingLabel.labelColor ? editingLabel.labelColor : allColors[0]

  function ColorLabel(color: LabelColor) {
    return (
      <Flex alignItems={'center'}>
        <Box
          mr="1"
          className="event-label event-label--hoverable"
          style={{ backgroundColor: color.hex }}
        ></Box>
        <Text>{color.title}</Text>
      </Flex>
    )
  }
  function addErrorMessage(title: string, details: string = '') {
    toastIdRef.current && toast.close(toastIdRef.current)

    toastIdRef.current = toast({
      title: title,
      duration: 3000,
      render: (p) => {
        return <InfoAlert onClose={p.onClose} title={title} icon={'info'} details={details} />
      },
    })
  }

  return (
    <Modal isOpen={true} onClose={props.onCloseModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize={'md'}>Add Tag</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="tag-name">
            <FormLabel fontSize={'sm'}>Name</FormLabel>
            <Input
              type="text"
              placeholder=""
              size="sm"
              fontSize={'sm'}
              value={editingLabel.labelTitle}
              onChange={(e) => {
                setEditingLabel({ ...editingLabel, labelTitle: e.target.value })
              }}
            />
          </FormControl>

          <FormControl id="tag-color" mt="2">
            <FormLabel fontSize={'sm'}>Color</FormLabel>

            <Menu>
              <MenuButton as={Button} size="sm" rightIcon={<FiChevronDown />} variant="ghost">
                {ColorLabel(selectedColor)}
              </MenuButton>
              <MenuList style={{ maxHeight: '14em' }} overflowY="scroll">
                {getSortedLabelColors().map((color) => {
                  return (
                    <MenuItem
                      key={color.hex}
                      fontSize={'sm'}
                      fontWeight="normal"
                      onClick={() => {
                        setEditingLabel((prevState) => {
                          return {
                            ...prevState,
                            labelColor: color,
                          }
                        })
                      }}
                    >
                      {ColorLabel(color)}
                    </MenuItem>
                  )
                })}
              </MenuList>
            </Menu>
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button variant={'ghost'} mr={3} onClick={props.onCloseModal}>
            Cancel
          </Button>

          <Button
            colorScheme="primary"
            onClick={() => {
              if (!editingLabel.labelTitle) {
                addErrorMessage(
                  "Tag name can't be empty",
                  'Please enter a tag name before submitting.'
                )
                return
              }

              const labelWithColor = { ...editingLabel, labelColor: selectedColor }
              props.onClickSaveLabel(labelWithColor)
            }}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditLabelModal
