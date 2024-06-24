// TrashBin.js
import React from 'react'
import { Flex } from '@chakra-ui/react'
import { FiTrash } from 'react-icons/fi'

const TrashBin = ({ isDragging, toRemove }) => {
  if (!isDragging) return null

  return (
    <Flex
      id="trash-bin"
      position="fixed"
      left="50%"
      bottom="20px"
      width="100px"
      height="100px"
      border="2px"
      borderColor={toRemove ? 'red.400' : 'blackAlpha.400'}
      justifyContent="center"
      alignItems="center"
      borderRadius="50%"
      zIndex="1000"
      backgroundColor={toRemove ? 'red.50' : 'white'}
    >
      <FiTrash size="24px" color={toRemove ? 'red.400' : 'black'} />
    </Flex>
  )
}

export default TrashBin
