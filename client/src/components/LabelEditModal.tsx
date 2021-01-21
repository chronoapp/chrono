import React, { useContext } from 'react'
import clsx from 'clsx'

import { getAuthToken, putLabel, createLabel } from '../util/Api'
import { getSortedLabelColors, LabelColor } from '../models/LabelColors'
import { AlertsContext } from '../components/AlertsContext'
import { LabelContext, LabelContextType, LabelModalState } from './LabelsContext'

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

  return (
    <div className={`modal ${newLabelModal.active ? 'is-active' : null}`}>
      <div className="modal-background"></div>
      <div className="modal-card" style={{ maxWidth: '30em' }}>
        <header className="modal-card-head">
          <p className="modal-card-title">Add Project</p>
        </header>
        <section className="modal-card-body">
          <div className="field">
            <label className="label has-text-left">Project Name</label>
            <div className="control">
              <input
                className="input"
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
            </div>
          </div>

          <div className="field">
            <label className="label has-text-left">Project Color</label>
            <div className="control has-text-left">
              <div className="select">
                <div className={clsx('dropdown', newLabelModal.colorPickerActive && 'is-active')}>
                  <div className="dropdown-trigger">
                    <button
                      className="button"
                      aria-haspopup="true"
                      aria-controls="dropdown-menu"
                      onClick={() => {
                        dispatch({
                          type: 'UPDATE_EDIT_LABEL',
                          payload: {
                            ...newLabelModal,
                            colorPickerActive: !newLabelModal.colorPickerActive,
                          },
                        })
                      }}
                    >
                      <span>{ColorLabel(selectedColor)}</span>
                      <span className="icon is-small">
                        <i className="fas fa-angle-down" aria-hidden="true"></i>
                      </span>
                    </button>
                  </div>
                  <div className="dropdown-menu" role="menu" style={{ maxHeight: '16em' }}>
                    <div
                      className="dropdown-content"
                      style={{ overflowY: 'scroll', maxHeight: 'inherit' }}
                    >
                      {getSortedLabelColors().map((color) => {
                        return (
                          <a
                            key={color.hex}
                            className="dropdown-item"
                            onClick={() => {
                              dispatch({
                                type: 'UPDATE_EDIT_LABEL',
                                payload: {
                                  ...newLabelModal,
                                  colorPickerActive: false,
                                  labelColor: color,
                                },
                              })
                            }}
                          >
                            {ColorLabel(color)}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <footer className="modal-card-foot" style={{ justifyContent: 'flex-end' }}>
          <button
            className="button is-primary"
            onClick={() => {
              onClickSaveLabel(newLabelModal, selectedColor)
            }}
          >
            Save
          </button>
          <button
            className="button"
            onClick={() => {
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
            }}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}

export default EditLabelModal
