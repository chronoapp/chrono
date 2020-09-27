import React, { useState, useContext, useEffect } from 'react'
import clsx from 'clsx'
import { getAuthToken, getLabels, putLabel, createLabel } from '../util/Api'

import Icon from '@mdi/react'
import { mdiDotsHorizontal, mdiPlus } from '@mdi/js'
import { getSortedLabelColors, LabelColor } from '../models/LabelColors'

import { AlertsContext } from '../components/AlertsContext'
import { LabelContext, LabelContextType } from './LabelsContext'
import LabelTree from './LabelTree'

/**
 * Panel with a list of labels.
 */
function LabelPanel() {
  const { labelState, dispatch } = useContext<LabelContextType>(LabelContext)
  const alertsContext = useContext(AlertsContext)

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

  function renderColorLabel(color: LabelColor) {
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

  function renderProjectLabelModal() {
    const allColors = getSortedLabelColors()
    const newLabelModal = labelState.editingLabel
    const selectedColor = newLabelModal.color ? newLabelModal.color : allColors[0]

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
                        <span>{renderColorLabel(selectedColor)}</span>
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
                                    color,
                                  },
                                })
                              }}
                            >
                              {renderColorLabel(color)}
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
              className="button is-link"
              onClick={() => {
                createLabel(newLabelModal.labelTitle, selectedColor.hex, getAuthToken()).then(
                  (label) => {
                    dispatch({
                      type: 'UPDATE_EDIT_LABEL',
                      payload: { ...newLabelModal, active: false, labelTitle: '' },
                    })
                    dispatch({ type: 'UPDATE', payload: label })
                    alertsContext.addMessage(`Created new tag ${label.title}.`)
                  }
                )
              }}
            >
              Add
            </button>
            <button
              className="button"
              onClick={() => {
                dispatch({
                  type: 'UPDATE_EDIT_LABEL',
                  payload: { ...newLabelModal, active: false, labelTitle: '' },
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
      {labelState.editingLabel.active && renderProjectLabelModal()}
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
