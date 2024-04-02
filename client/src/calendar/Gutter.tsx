import React, { useState } from 'react'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableGutter } from './SortableGutter'
import GutterContent from './GutterContent'
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core'
import { IconButton, Flex } from '@chakra-ui/react'
import { FiPlus } from 'react-icons/fi'

const GUTTER_LINE_WIDTH = 0.5

const Gutter = ({ slotMetrics, gutterRef, gutters, addGutter, width, setGutters }) => {
  const [activeId, setActiveId] = useState(null)

  const getGutterPos = (id) => gutters.findIndex((gutter) => gutter.id === id)
  function handleDragStart(event) {
    const { active } = event
    setActiveId(active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      setGutters((gutters) => {
        const originalPos = getGutterPos(active.id)
        const newPos = getGutterPos(over.id)

        return arrayMove(gutters, originalPos, newPos)
      })
    }
  }

  const restrictToXAxis = ({ transform }) => ({
    ...transform,
    y: 0, // Restrict movement to the x-axis by setting the y-coordinate to 0
  })

  function ToogleAdditionalTimezone({ addGutter }) {
    return (
      <IconButton
        size={'xs'}
        variant="ghost"
        aria-label="adding additional timezones"
        icon={<FiPlus />}
        onClick={() => addGutter()}
        width="4"
      />
    )
  }

  return (
    <Flex direction={'column'}>
      <Flex
        width={width}
        justifyContent={'flex-start'}
        alignItems={'center'}
        className="rbc-label cal-time-header-gutter"
      >
        <ToogleAdditionalTimezone addGutter={addGutter} />
      </Flex>
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToXAxis]}
      >
        <SortableContext
          items={gutters.map((gutter) => gutter.id)}
          strategy={horizontalListSortingStrategy}
        >
          {gutters.map((gutter) => (
            <SortableGutter
              key={gutter.id}
              id={gutter.id}
              slotMetrics={slotMetrics}
              gutterRef={gutterRef}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div style={{ boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.2)' }}>
              <GutterContent slotMetrics={slotMetrics} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="cal-time-gutter">
        {slotMetrics.current.groups.map((_group, idx) => {
          return renderDateTick(idx)
        })}
      </div>
    </Flex>
  )
}

export default Gutter

function renderDateTick(idx: number) {
  return (
    <div
      className="cal-timeslot-group"
      key={idx}
      style={{
        width: `${GUTTER_LINE_WIDTH}rem`,
        borderLeft: 0,
      }}
    ></div>
  )
}
