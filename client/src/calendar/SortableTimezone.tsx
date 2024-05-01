import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TimezoneLabel from './TimezoneLabel'

/**
 * This component renders a sortable timezone using useSortable fom @dnd-kit.
 */
export const SortableTimezone = ({ id, timezone, gutterWidth }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? '2px 0px 7px rgba(0,0,0,0.5)' : 'none',
    opacity: isDragging ? 0.8 : 1,
    backgroundColor: isDragging ? 'lightgrey' : 'transparent',
  }

  return (
    <div ref={setNodeRef} style={{ ...style }} {...attributes} {...listeners}>
      <TimezoneLabel timezone={timezone} gutterWidth={gutterWidth} />
    </div>
  )
}
