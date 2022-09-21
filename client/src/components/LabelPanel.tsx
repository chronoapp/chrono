import React, { useContext, useEffect } from 'react'
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

import { getAuthToken, getLabels } from '@/util/Api'
import { LabelContext, LabelContextType } from '@/contexts/LabelsContext'
import LabelEditModal from './LabelEditModal'
import LabelTree from './LabelTree'

/**
 * Panel with a list of labels.
 */
function LabelPanel() {
  const { labelState, dispatch } = useContext<LabelContextType>(LabelContext)

  useEffect(() => {
    async function loadLabels() {
      dispatch({
        type: 'START',
      })
      const authToken = getAuthToken()
      const labels = await getLabels(authToken)

      dispatch({
        type: 'INIT',
        payload: labels,
      })
    }

    loadLabels()
  }, [])

  function onClickAddProject() {
    dispatch({
      type: 'UPDATE_EDIT_LABEL',
      payload: {
        ...labelState.editingLabel,
        active: true,
      },
    })
  }

  return (
    <>
      {labelState.editingLabel.active && <LabelEditModal />}

      <Accordion allowToggle={true}>
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
              onClick={onClickAddProject}
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
