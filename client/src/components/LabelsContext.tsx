import React, { createContext, useReducer } from 'react'

import update from 'immutability-helper'
import { Label } from '../models/Label'
import { normalizeArr } from '../lib/normalizer'

export interface LabelState {
  loading: boolean
  labelsById: Record<number, Label>
}

type ActionType =
  | { type: 'START' }
  | { type: 'INIT'; payload: Label[] }
  | { type: 'UPDATE'; payload: Label }
  | { type: 'DELETE'; payload: number }
  | { type: 'UPDATE_MULTI'; payload: Record<number, Label> }

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
    default:
      throw new Error('Unknown action')
  }
}

export function LabelsContextProvider(props: any) {
  const [labelState, dispatch] = useReducer(labelReducer, {
    loading: false,
    labelsById: {},
  })

  return (
    <LabelContext.Provider value={{ labelState, dispatch }}>{props.children}</LabelContext.Provider>
  )
}
