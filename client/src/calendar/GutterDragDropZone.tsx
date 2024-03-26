import React, { useRef } from 'react'
import { useDrop } from 'react-dnd'
import { Flex } from '@chakra-ui/react'

interface GutterDragDropZoneProps {
  removeGutter: (id: number) => void
  children: React.ReactNode
}

const GutterDragDropZone: React.FC<GutterDragDropZoneProps> = ({ children, removeGutter }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [, drop] = useDrop({
    accept: 'GUTTER',
    drop: (item: { id: number }, monitor) => {
      if (!monitor.didDrop()) {
        removeGutter(item.id)
      }
    },
  })

  drop(ref) // Connect the drop target

  return (
    <Flex ref={ref} className="gutter-drag-drop-zone">
      {children}
    </Flex>
  )
}

export default GutterDragDropZone
