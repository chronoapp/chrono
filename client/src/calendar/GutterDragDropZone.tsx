import React, { useRef } from 'react'
import { Flex } from '@chakra-ui/react'
import { getBoundsForNode } from '@/util/Selection'

function GutterDragDropZone({ children, removeGutter }) {
  const containerRef = useRef(null)
  function isDropOutsideBounds(e, containerRef) {
    if (!containerRef.current) return true // Assume out of bounds if no container

    const { left, top, right, bottom } = getBoundsForNode(containerRef.current)
    const { clientX, clientY } = e

    // Check if the drop is outside the container's bounds
    return clientX < left || clientX > right || clientY < top || clientY > bottom
  }

  const handleDragOver = (e) => {
    e.preventDefault() // Always call this to allow dropping.
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const gutterId = parseInt(e.dataTransfer.getData('text/plain'), 10)

    if (isDropOutsideBounds(e, containerRef)) {
      removeGutter(gutterId)
    }
  }
  return (
    <Flex
      ref={containerRef}
      className="gutter-drag-drop-zone"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </Flex>
  )
}

export default GutterDragDropZone
