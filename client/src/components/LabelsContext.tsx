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
  | { type: 'UPDATE_POSITIONS'; payload: Record<number, number> }

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
    case 'UPDATE_POSITIONS':
      const labelIdToPositions = action.payload

      const updates = {}
      for (let labelId in labelIdToPositions) {
        updates[labelId] = { $merge: { position: labelIdToPositions[labelId] } }
      }
      const updatedLabels = update(labelState.labelsById, updates)

      return {
        ...labelState,
        labelsById: updatedLabels,
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
