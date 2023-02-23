import { atom } from 'recoil'

import { Label } from '@/models/Label'
import { LabelColor } from '@/models/LabelColors'

export interface LabelState {
  loading: boolean
  labelsById: Record<string, Label>
  editingLabel: LabelModalState
}

export interface LabelModalState {
  active: boolean
  labelTitle: string
  labelColor?: LabelColor
  labelId?: string
}

export const labelsState = atom({
  key: 'labels-state',
  default: {
    loading: false,
    labelsById: {},
    editingLabel: { active: false, labelTitle: '' },
  } as LabelState,
})
