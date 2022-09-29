import React from 'react'
import { Subtract } from 'utility-types'
import { useRecoilValue } from 'recoil'

import { dragDropActionState, editingEventState } from '@/state/EventsState'
import useEventActions from '@/state/useEventActions'
import { EventActionsType } from '@/state/useEventActions'
import { EditingEvent, DragDropAction } from '@/state/EventsState'

export interface InjectedEventActionsProps {
  eventActions: EventActionsType
  dragAndDropAction: DragDropAction
  editingEvent: EditingEvent | null
}

export const withEventActions =
  <P extends InjectedEventActionsProps>(
    Component: React.ComponentType<P>
  ): React.FC<Subtract<P, InjectedEventActionsProps>> =>
  (props) => {
    const eventActions = useEventActions()
    const editingEvent = useRecoilValue(editingEventState)
    const dragAndDropAction = useRecoilValue(dragDropActionState)

    return (
      <Component
        {...(props as P)}
        eventActions={eventActions}
        dragAndDropAction={dragAndDropAction}
        editingEvent={editingEvent}
      />
    )
  }
