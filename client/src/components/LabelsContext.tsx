import React, { createContext, useReducer } from 'react'

import { Label } from '../models/Label'

export interface LabelState {
  labels: Label[]
  loading: boolean
}

type ActionType =
  | { type: 'START' }
  | { type: 'INIT'; payload: Label[] }
  | { type: 'UPDATE'; payload: Label }

const initialState: LabelState = {
  labels: [],
  loading: false,
}

/**
 * TODO: Type this.
 */
export const LabelContext = createContext(undefined)

function labelReducer({ labels }: LabelState, action: ActionType) {
  switch (action.type) {
    case 'START':
      return {
        loading: true,
      }
    case 'INIT':
      return {
        loading: false,
        labels: action.payload,
      }
    case 'UPDATE':
      const label = action.payload
      return {
        labels: labels.map((l) => {
          if (label.key == l.key) {
            return label
          } else {
            return l
          }
        }),
      }
    default:
      throw new Error('Unknown action')
  }
}

export function LabelsContextProvider(props: any) {
  const [labelState, dispatch] = useReducer(labelReducer, initialState)
  return (
    <LabelContext.Provider value={{ labelState, dispatch }}>{props.children}</LabelContext.Provider>
  )
}
