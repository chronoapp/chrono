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
import { FiPlus } from 'react-icons/fi'
import { FaTag } from 'react-icons/fa'
import { normalizeArr } from '@/lib/normalizer'

import { getLabels } from '@/util/Api'
import LabelEditModal from './LabelEditModal'
import LabelTree from './LabelTree'
import { labelsState } from '@/state/LabelsState'

/**
 * Panel with a list of labels.
 */
function LabelPanel() {
  const [labelState, setLabelState] = useRecoilState(labelsState)

  useEffect(() => {
    async function loadLabels() {
      setLabelState((labelState) => {
        return { ...labelState, loading: true }
      })
      const labels = await getLabels()

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

  return (
    <>
      {labelState.editingLabel?.active && <LabelEditModal />}

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
              fontSize={'sm'}
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
