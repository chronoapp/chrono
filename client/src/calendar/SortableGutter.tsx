import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import GutterContent from './GutterContent' // Make sure to import the child component

/**
 * This component renders a sortable gutter using useSortable fom @dnd-kit.
 */
export function SortableGutter({ id, gutterRef, slotMetrics }) {
  // removed const {listeners} to remove useDraggable hook for the gutter while keeping sortable functionality
  const { attributes, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? '2px 0px 7px rgba(0,0,0,0.5)' : 'none',
    opacity: isDragging ? 0.8 : 1,
    backgroundColor: isDragging ? '#f3f3f3' : 'transparent',
  }

  return (
    // removed {..listeners} to remove useDraggable hook for the gutter while keeping sortable functionality
    <div ref={setNodeRef} style={{ ...style }} {...attributes}>
      <GutterContent ref={gutterRef} slotMetrics={slotMetrics} />
    </div>
  )
}
