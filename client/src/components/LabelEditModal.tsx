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
  useToast,
} from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'
import { InfoAlert } from '@/components/Alert'
import { putLabel, createLabel } from '@/util/Api'
import { getSortedLabelColors, LabelColor } from '@/models/LabelColors'
import { useRecoilState } from 'recoil'
import { labelsState, LabelModalState } from '@/state/LabelsState'

function EditLabelModal() {
  const toast = useToast()
  const [labelState, setLabelState] = useRecoilState(labelsState)

  const allColors = getSortedLabelColors()
  const newLabelModal = labelState.editingLabel
  const selectedColor = newLabelModal.labelColor ? newLabelModal.labelColor : allColors[0]

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

  function onClickSaveLabel(newLabelModal: LabelModalState, selectedColor: LabelColor) {
    const updateLabel = (label) => {
      setLabelState((prevState) => {
        const newLabels = { ...prevState.labelsById, [label.id]: label }
        return {
          ...prevState,
          labelsById: newLabels,
          editingLabel: { ...newLabelModal, active: false, labelTitle: '' },
        }
      })

      toast({
        render: (props) => (
          <InfoAlert title={`Saved tag ${label.title}.`} onClose={props.onClose} />
        ),
      })
    }

    if (newLabelModal.labelId) {
      const editLabel = labelState.labelsById[newLabelModal.labelId]
      const updatedLabel = {
        ...editLabel,
        color_hex: selectedColor.hex,
        title: newLabelModal.labelTitle,
      }
      console.log(updatedLabel)
      putLabel(updatedLabel).then(updateLabel)
    } else {
      createLabel(newLabelModal.labelTitle, selectedColor.hex).then(updateLabel)
    }
  }

  function onCloseModal() {
    setLabelState((prevState) => {
      return {
        ...prevState,
        editingLabel: {
          ...newLabelModal,
          active: false,
          labelTitle: '',
          labelId: undefined,
          labelColor: undefined,
        },
      }
    })
  }

  return (
    <Modal isOpen={true} onClose={onCloseModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Tag</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl id="tag-name" isRequired>
            <FormLabel>Tag Name</FormLabel>
            <Input
              type="text"
              placeholder=""
              value={newLabelModal.labelTitle}
              onChange={(e) => {
                setLabelState((prevState) => {
                  return {
                    ...prevState,
                    editingLabel: {
                      ...newLabelModal,
                      labelTitle: e.target.value,
                    },
                  }
                })
              }}
            />
          </FormControl>

          <FormControl id="tag-color" mt="2">
            <FormLabel>Tag Color</FormLabel>

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
                        setLabelState((prevState) => {
                          return {
                            ...prevState,
                            editingLabel: {
                              ...newLabelModal,
                              labelColor: color,
                            },
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
          <Button variant={'ghost'} mr={3} onClick={onCloseModal}>
            Cancel
          </Button>
          <Button
            colorScheme="primary"
            onClick={() => onClickSaveLabel(newLabelModal, selectedColor)}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditLabelModal
