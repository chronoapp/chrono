import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import GutterContent from './GutterContent' // Make sure to import the child component

export function SortableGutter({ id, gutterRef, slotMetrics }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? '2px 0px 7px rgba(0,0,0,0.5)' : 'none',
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div ref={setNodeRef} style={{ ...style }} {...attributes} {...listeners}>
      <GutterContent ref={gutterRef} slotMetrics={slotMetrics} />
    </div>
  )
}
