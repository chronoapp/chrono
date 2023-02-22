import { atom } from 'recoil'

/**
 * Stores the current view of the calendar.
 */
export const uiState = atom({
  key: 'ui-state',
  default: {
    expandWeeklyRows: false,
  },
})
