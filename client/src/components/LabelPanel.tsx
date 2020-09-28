import React, { useContext, useEffect } from 'react'
import { getAuthToken, getLabels } from '../util/Api'

import Icon from '@mdi/react'
import { mdiPlus } from '@mdi/js'
import { LabelContext, LabelContextType } from './LabelsContext'
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
      <LabelTree />

      <button
        className="button is-text"
        onClick={onClickAddProject}
        style={{ justifyContent: 'left' }}
      >
        <Icon path={mdiPlus} size={1} horizontal vertical />
        add tag
      </button>
    </>
  )
}

export default LabelPanel
