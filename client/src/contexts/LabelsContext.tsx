import React, { createContext, useReducer } from 'react'

import produce from 'immer'
import { Label } from '@/models/Label'
import { normalizeArr } from '@/lib/normalizer'
import { LabelColor } from '@/models/LabelColors'

export interface LabelState {
  loading: boolean
  labelsById: Record<number, Label>
  editingLabel: LabelModalState
}

export interface LabelModalState {
  active: boolean
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

      return produce(labelState, (draft) => {
        draft.labelsById[label.id] = label
      })

    case 'UPDATE_MULTI':
      const labelMap = action.payload
      return produce(labelState, (draft) => {
        for (let labelId in labelMap) {
          draft.labelsById[labelId] = labelMap[labelId]
        }
      })

    case 'DELETE':
      const labelId = action.payload
      return produce(labelState, (draft) => {
        delete draft.labelsById[labelId]
      })

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
    editingLabel: { active: false, labelTitle: '' },
  })

  return (
    <LabelContext.Provider value={{ labelState, dispatch }}>{props.children}</LabelContext.Provider>
  )
}
