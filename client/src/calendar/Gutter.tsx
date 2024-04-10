import React, { useState } from 'react'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableGutter } from './SortableGutter'
import GutterContent from './GutterContent'
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core'
import { Flex } from '@chakra-ui/react'
const GUTTER_LINE_WIDTH = 0.5

const Gutter = ({ slotMetrics, gutterRef, timezones, setTimezones }) => {
  const [activeId, setActiveId] = useState(null)

  const getGutterPos = (id) => timezones.findIndex((gutter) => gutter.id === id)
  function handleDragStart(event) {
    const { active } = event
    setActiveId(active.id)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      setTimezones((timezones) => {
        const originalPos = getGutterPos(active.id)
        const newPos = getGutterPos(over.id)

        return arrayMove(timezones, originalPos, newPos)
      })
    }
  }

  const restrictToXAxis = ({ transform }) => ({
    ...transform,
    y: 0, // Restrict movement to the x-axis by setting the y-coordinate to 0
  })

  return (
    <Flex direction={'row'}>
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToXAxis]}
      >
        <SortableContext
          items={timezones.map((gutter) => gutter.id)}
          strategy={horizontalListSortingStrategy}
        >
          {timezones.map((gutter) => (
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
