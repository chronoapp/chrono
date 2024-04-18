import React, { useContext, useEffect } from 'react'
import { useRecoilState, useSetRecoilState } from 'recoil'

import {
  Accordion,
  AccordionIcon,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  Button,
  Flex,
  Text,
} from '@chakra-ui/react'
import { Icon } from '@chakra-ui/react'
import { useToast, ToastId } from '@chakra-ui/react'

import { FiPlus } from 'react-icons/fi'
import { FaTag } from 'react-icons/fa'

import { InfoAlert } from '@/components/Alert'
import LabelEditModal from '@/components/LabelEditModal'
import LabelTree from '@/components/LabelTree'

import { normalizeArr } from '@/lib/normalizer'
import * as API from '@/util/Api'
import { labelsState, EditingLabelState } from '@/state/LabelsState'
import { LabelColor } from '@/models/LabelColors'

/**
 * Panel with a list of labels.
 */
function LabelPanel() {
  const [labelState, setLabelState] = useRecoilState(labelsState)
  const toast = useToast()
  const toastIdRef = React.useRef<ToastId>()

  useEffect(() => {
    async function loadLabels() {
      setLabelState((labelState) => {
        return { ...labelState, loading: true }
      })
      const labels = await API.getLabels()

      setLabelState((labelState) => {
        return { ...labelState, loading: false, labelsById: normalizeArr(labels, 'id') }
      })
    }

    loadLabels()
  }, [])

  function addNewLabel() {
    setLabelState((labelState) => {
      return {
        ...labelState,
        editingLabel: {
          ...labelState.editingLabel,
          active: true,
        },
      }
    })
  }

  function updateLabelState(label) {
    setLabelState((prevState) => {
      const newLabels = { ...prevState.labelsById, [label.id]: label }
      return {
        ...prevState,
        labelsById: newLabels,
        editingLabel: { ...prevState.editingLabel, active: false, labelTitle: '' },
      }
    })

    toastIdRef.current && toast.close(toastIdRef.current)
    toastIdRef.current = toast({
      render: (props) => <InfoAlert title={`Saved tag ${label.title}.`} onClose={props.onClose} />,
    })
  }

  function onClickSaveLabel(newLabel: EditingLabelState) {
    if (newLabel.labelId) {
      const editLabel = labelState.labelsById[newLabel.labelId]
      const updatedLabel = {
        ...editLabel,
        color_hex: newLabel.labelColor!.hex,
        title: newLabel.labelTitle,
      }

      API.putLabel(updatedLabel).then(updateLabelState)
    } else {
      API.createLabel(newLabel.labelTitle, newLabel.labelColor!.hex).then(updateLabelState)
    }
  }

  function onCloseModal() {
    setLabelState((prevState) => {
      return {
        ...prevState,
        editingLabel: {
          ...prevState.editingLabel,
          active: false,
          labelTitle: '',
          labelId: undefined,
          labelColor: undefined,
        },
      }
    })
  }

  return (
    <>
      {labelState.editingLabel?.active && (
        <LabelEditModal
          editingLabel={labelState.editingLabel}
          onClickSaveLabel={onClickSaveLabel}
          onCloseModal={onCloseModal}
        />
      )}

      <Accordion allowToggle={true} defaultIndex={0}>
        <AccordionItem border="0" mt="1">
          <AccordionButton
            height="8"
            p="1"
            display="flex"
            justifyContent="space-between"
            alignItems={'center'}
          >
            <Flex alignItems={'center'}>
              <Icon as={FaTag} color="gray.400" w="22" ml="1" />
              <Text pl="2" color="gray.800" fontSize={'sm'} fontWeight="md">
                Tags
              </Text>
            </Flex>
            <AccordionIcon color="gray.600" />
          </AccordionButton>

          <AccordionPanel p="0">
            <LabelTree allowEdit={true} />

            <Button
              fontSize={'xs'}
              color="gray.600"
              fontWeight="normal"
              variant="link"
              onClick={addNewLabel}
              float="left"
              m="2"
              ml="5"
            >
              <FiPlus /> add tag
            </Button>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </>
  )
}

export default LabelPanel
