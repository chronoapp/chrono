import React, { useContext } from 'react'
import clsx from 'clsx'
import {
  Button,
  Text,
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
import { FiChevronDown } from 'react-icons/fi'

import { getAuthToken, putLabel, createLabel } from '@/util/Api'
import { getSortedLabelColors, LabelColor } from '@/models/LabelColors'
import { AlertsContext } from '@/contexts/AlertsContext'
import { LabelContext, LabelContextType, LabelModalState } from '@/contexts/LabelsContext'

function EditLabelModal() {
  const alertsContext = useContext(AlertsContext)
  const { labelState, dispatch } = useContext<LabelContextType>(LabelContext)

  const allColors = getSortedLabelColors()
  const newLabelModal = labelState.editingLabel
  const selectedColor = newLabelModal.labelColor ? newLabelModal.labelColor : allColors[0]

  function ColorLabel(color: LabelColor) {
    return (
      <span style={{ display: 'flex' }}>
        <span
          className="event-label event-label--hoverable mr-2"
          style={{ backgroundColor: color.hex }}
        ></span>
        <p>{color.title}</p>
      </span>
    )
  }

  function onClickSaveLabel(newLabelModal: LabelModalState, selectedColor: LabelColor) {
    const updateLabel = (label) => {
      dispatch({
        type: 'UPDATE_EDIT_LABEL',
        payload: { ...newLabelModal, active: false, labelTitle: '' },
      })
      dispatch({ type: 'UPDATE', payload: label })
      alertsContext.addMessage(`Saved tag ${label.title}.`)
    }

    if (newLabelModal.labelId) {
      const editLabel = labelState.labelsById[newLabelModal.labelId]
      const updatedLabel = {
        ...editLabel,
        color_hex: selectedColor.hex,
        title: newLabelModal.labelTitle,
      }
      console.log(updatedLabel)
      putLabel(updatedLabel, getAuthToken()).then(updateLabel)
    } else {
      createLabel(newLabelModal.labelTitle, selectedColor.hex, getAuthToken()).then(updateLabel)
    }
  }

  function onCloseModal() {
    dispatch({
      type: 'UPDATE_EDIT_LABEL',
      payload: {
        ...newLabelModal,
        active: false,
        colorPickerActive: false,
        labelTitle: '',
        labelId: undefined,
        labelColor: undefined,
      },
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
                dispatch({
                  type: 'UPDATE_EDIT_LABEL',
                  payload: { ...newLabelModal, labelTitle: e.target.value },
                })
              }}
            />
          </FormControl>

          <FormControl id="tag-color" mt="2">
            <FormLabel>Tag Color</FormLabel>

            <Menu>
              <MenuButton as={Button} size="sm" rightIcon={<FiChevronDown />}>
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
                        dispatch({
                          type: 'UPDATE_EDIT_LABEL',
                          payload: {
                            ...newLabelModal,
                            labelColor: color,
                          },
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
