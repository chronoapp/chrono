import React, { forwardRef } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import GutterContent from './GutterContent' // Make sure to import the child component

export function SortableGutter({ id, gutterRef, slotMetrics }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={{ ...style }} {...attributes} {...listeners}>
      <GutterContent ref={gutterRef} slotMetrics={slotMetrics} />
    </div>
  )
}
