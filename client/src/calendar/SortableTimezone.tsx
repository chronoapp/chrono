import React, { useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FiTrash2 } from 'react-icons/fi'

import { Popover, PopoverTrigger, PopoverContent, Button, Flex } from '@chakra-ui/react'
import TimezoneLabel from './TimezoneLabel'

/**
 * This component renders a sortable timezone using useSortable from @dnd-kit.
 */
export const SortableTimezone = ({ id, timezone, gutterWidth, onDeleteTimezone, allowDelete }) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

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

  const handleRightClick = useCallback((e) => {
    e.preventDefault()
    setIsPopoverOpen(true)
  }, [])

  const handleClosePopover = useCallback(() => {
    setIsPopoverOpen(false)
  }, [])

  const handleDeleteTimezone = useCallback(() => {
    onDeleteTimezone(id)
    setIsPopoverOpen(false)
  }, [id, onDeleteTimezone])

  if (!allowDelete) {
    return (
      <Flex ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <TimezoneLabel timezone={timezone} gutterWidth={gutterWidth} />
      </Flex>
    )
  } else {
    return (
      <Popover
        isOpen={isPopoverOpen}
        onClose={handleClosePopover}
        placement="right"
        closeOnBlur={true}
        closeOnEsc={true}
      >
        <PopoverTrigger>
          <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onContextMenu={handleRightClick}
          >
            <TimezoneLabel timezone={timezone} gutterWidth={gutterWidth} />
          </div>
        </PopoverTrigger>
        <PopoverContent width="auto" p={0}>
          <Button
            onClick={handleDeleteTimezone}
            size="sm"
            leftIcon={<FiTrash2 size="12px" color="grey" />}
            variant="ghost"
          >
            Delete
          </Button>
        </PopoverContent>
      </Popover>
    )
  }
}
