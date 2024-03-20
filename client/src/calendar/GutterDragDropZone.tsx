import { Flex } from '@chakra-ui/react'

function GutterDragDropZone({ children }) {
  const handleDragOver = (e) => {
    e.preventDefault()
    // Implement logic for when an item is dragged over the gutter area
  }

  const handleDrop = (e) => {
    e.preventDefault()
    // Implement drop logic here
  }

  return (
    <Flex className="gutter-drag-drop-zone" onDragOver={handleDragOver} onDrop={handleDrop}>
      {children}
    </Flex>
  )
}
export default GutterDragDropZone
