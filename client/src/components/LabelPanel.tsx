import React, { useContext, useEffect } from 'react'
import { Button } from '@chakra-ui/react'
import { FiPlus } from 'react-icons/fi'

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
      <span className="has-text-left has-text-weight-medium mt-3">Tags</span>
      <LabelTree allowEdit={true} />

      <Button
        color="gray.600"
        fontWeight="normal"
        variant="link"
        onClick={onClickAddProject}
        justifyContent="left"
        m="2"
      >
        <FiPlus /> add tag
      </Button>
    </>
  )
}

export default LabelPanel
