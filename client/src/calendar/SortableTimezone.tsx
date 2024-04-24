import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TimezoneLabel from './TimezoneLabel'

export const SortableTimezone = ({ id, gutterWidth }) => {
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
      <TimezoneLabel id={id} gutterWidth={gutterWidth} />
    </div>
  )
}
