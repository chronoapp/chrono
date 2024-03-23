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
    const index = parseInt(e.dataTransfer.getData('text/plain'), 10)

    // Assuming the logic to determine if it's outside bounds goes here.
    // For simplicity, let's assume you've defined a function `isDropOutsideBounds(e, containerRef)`
    // that returns true if the drop is outside the desired bounds.

    if (isDropOutsideBounds(e, containerRef)) {
      removeGutter(index)
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
