import React, { createContext, useReducer } from 'react'

import update from 'immutability-helper'
import { Label } from '../models/Label'
import { normalizeArr } from '../lib/normalizer'
import { LabelColor } from '../models/LabelColors'

export interface LabelState {
  loading: boolean
  labelsById: Record<number, Label>
  editingLabel: LabelModalState
}

export interface LabelModalState {
  active: boolean
  colorPickerActive: boolean
  labelTitle: string
  labelColor?: LabelColor
  labelId?: number
}

type ActionType =
  | { type: 'START' }
  | { type: 'INIT'; payload: Label[] }
  | { type: 'UPDATE'; payload: Label }
  | { type: 'DELETE'; payload: number }
  | { type: 'UPDATE_MULTI'; payload: Record<number, Label> }
  | { type: 'UPDATE_EDIT_LABEL'; payload: LabelModalState }

export interface LabelContextType {
  labelState: LabelState
  dispatch: React.Dispatch<ActionType>
}

/**
 * TODO: Type this.
 */
export const LabelContext = createContext<LabelContextType>(undefined!)

function labelReducer(labelState: LabelState, action: ActionType) {
  switch (action.type) {
    case 'START':
      return {
        ...labelState,
        loading: true,
      }
    case 'INIT':
      return {
        ...labelState,
        loading: false,
        labelsById: normalizeArr(action.payload, 'id'),
      }
    case 'UPDATE':
      const label = action.payload
      return {
        ...labelState,
        labelsById: update(labelState.labelsById, { [label.id]: { $set: label } }),
      }
    case 'UPDATE_MULTI':
      const labelMap = action.payload

      const updates = {}
      for (let labelId in labelMap) {
        updates[labelId] = { $set: labelMap[labelId] }
      }
      return {
        ...labelState,
        labelsById: update(labelState.labelsById, updates),
      }
    case 'DELETE':
      const labelId = action.payload
      return {
        ...labelState,
        labelsById: update(labelState.labelsById, { $unset: [labelId] }),
      }
    case 'UPDATE_EDIT_LABEL':
      return {
        ...labelState,
        editingLabel: action.payload,
      }
    default:
      throw new Error('Unknown action')
  }
}

export function LabelsContextProvider(props: any) {
  const [labelState, dispatch] = useReducer(labelReducer, {
    loading: false,
    labelsById: {},
    editingLabel: { active: false, colorPickerActive: false, labelTitle: '' },
  })

  return (
    <LabelContext.Provider value={{ labelState, dispatch }}>{props.children}</LabelContext.Provider>
  )
}
