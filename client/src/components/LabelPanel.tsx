import React, { useState, useContext, useEffect } from 'react'
import { getAuthToken, getLabels, putLabel } from '../util/Api'

import Icon from '@mdi/react'
import { mdiDotsHorizontal, mdiPlus } from '@mdi/js'

import Hoverable from '../lib/Hoverable'
import ColorPicker from './ColorPicker'
import { Label } from '../models/Label'
import { LABEL_COLORS } from '../models/LabelColors'
import { LabelContext } from './LabelsContext'

interface LabelModalState {
  active: boolean
  label: Label
}

/**
 * Panel with a list of labels.
 */
function LabelPanel() {
  const [selectedLabelKeyColor, setSelectedLabelKeyColor] = useState('')
  const { labelState, dispatch } = useContext<any>(LabelContext)

  const [newLabelModal, setNewLabelModal] = useState<LabelModalState>({
    active: false,
    label: undefined,
  })

  useEffect(() => {
    async function loadLabels() {
      const authToken = getAuthToken()
      const labels = await getLabels(authToken)

      dispatch({
        type: 'INIT',
        payload: labels,
      })
    }

    loadLabels()
  }, [])

  async function updateLabel(label: Label) {
    const authToken = getAuthToken()
    const updatedLabel = await putLabel(label, authToken)
    dispatch({
      type: 'UPDATE',
      payload: updatedLabel,
    })
  }

  function toggleLabelKeyColor(labelKey: string) {
    if (labelKey == selectedLabelKeyColor) {
      setSelectedLabelKeyColor('')
    } else {
      setSelectedLabelKeyColor(labelKey)
    }
  }

  function onClickLabelColor(labelColor: string) {
    const selectedLabel = labelState.labels.find(
      (label: Label) => label.key == selectedLabelKeyColor
    )
    if (selectedLabel) {
      selectedLabel.color_hex = labelColor
      updateLabel(selectedLabel)
    }
    setSelectedLabelKeyColor('')
  }

  function getLabel(label: Label) {
    return (
      <Hoverable key={label.id}>
        {(isMouseInside: boolean, mouseEnter: any, mouseLeave: any) => (
          <a
            onMouseEnter={mouseEnter}
            onMouseLeave={mouseLeave}
            key={label.key}
            className={`tag-block`}
          >
            <div className={`dropdown ${label.key === selectedLabelKeyColor ? 'is-active' : ''}`}>
              <div
                onClick={(_) => toggleLabelKeyColor(label.key)}
                style={{ backgroundColor: label.color_hex }}
                className="event-label event-label--hoverable dropdown-trigger"
              ></div>
              {label.key === selectedLabelKeyColor ? (
                <ColorPicker onSelectLabelColor={onClickLabelColor} />
              ) : null}
            </div>
            <span style={{ marginLeft: 10 }}>{label.title}</span>
            {isMouseInside ? (
              <Icon
                path={mdiDotsHorizontal}
                style={{ marginLeft: 'auto' }}
                size={1}
                horizontal
                vertical
              />
            ) : null}
          </a>
        )}
      </Hoverable>
    )
  }

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
                  style={{ backgroundColor: newLabelModal.label.color_hex }}
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
      <span className="has-text-left has-text-weight-medium">Tags</span>
      <div style={{ marginBottom: '0.5rem' }}>{labelState.labels.map(getLabel)}</div>
      <button className="button is-white has-text-left" onClick={onClickAddProject}>
        <Icon path={mdiPlus} size={1} horizontal vertical />
        Add Tag
      </button>
    </>
  )
}

export default LabelPanel
