import React, { useState, useContext, useEffect } from 'react'
import { getAuthToken, getLabels, putLabel } from '../util/Api'

import Icon from '@mdi/react'
import { mdiDotsHorizontal, mdiPlus } from '@mdi/js'

import ColorPicker from './ColorPicker'
import { Label } from '../models/Label'
import { LABEL_COLORS } from '../models/LabelColors'
import { LabelContext, LabelContextType } from './LabelsContext'
import LabelTree from './LabelTree'

interface LabelModalState {
  active: boolean
  label?: Label
}

/**
 * Panel with a list of labels.
 */
function LabelPanel() {
  const { labelState, dispatch } = useContext<LabelContextType>(LabelContext)

  const [newLabelModal, setNewLabelModal] = useState<LabelModalState>({
    active: false,
    label: undefined,
  })

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

  function renderProjectLabelModal() {
    return (
      <div className={`modal ${newLabelModal.active ? 'is-active' : null}`}>
        <div className="modal-background"></div>
        <div className="modal-card">
          <header className="modal-card-head">
            <p className="modal-card-title">Add Project</p>
          </header>
          <section className="modal-card-body">
            <div className="field">
              <div className="control">
                <label className="label">Project Name</label>
                <input className="input" type="text" placeholder="" />
              </div>
            </div>
            <div className="field">
              <div className="control">
                <label className="label">Color</label>
                <div
                  onClick={(_) => {}}
                  style={{ backgroundColor: newLabelModal.label?.color_hex }}
                  className="event-label event-label--hoverable dropdown-trigger"
                ></div>
                <ColorPicker
                  onSelectLabelColor={(labelColor) => {
                    console.log(`SELECTED: ${labelColor}`)
                  }}
                />
              </div>
            </div>
          </section>
          <footer className="modal-card-foot">
            <button className="button is-link">Add</button>
            <button
              className="button"
              onClick={() => {
                setNewLabelModal({ active: false, label: undefined })
              }}
            >
              Cancel
            </button>
          </footer>
        </div>
      </div>
    )
  }

  function onClickAddProject() {
    const labelHex = LABEL_COLORS[0].hex
    const newLabelModal = {
      active: true,
      label: new Label(-1, 0, '', '', labelHex),
    }
    setNewLabelModal(newLabelModal)
  }

  return (
    <>
      {newLabelModal.active && renderProjectLabelModal()}
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
