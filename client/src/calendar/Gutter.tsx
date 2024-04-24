import React, { useState } from 'react'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DragOverlay } from '@dnd-kit/core'
import { SortableGutter } from './SortableGutter'
import { Flex } from '@chakra-ui/react'
import GutterContent from './GutterContent'
const GUTTER_LINE_WIDTH = 0.5

const Gutter = ({ slotMetrics, gutterRef, timezones, activeId }) => {
  return (
    <Flex direction={'row'}>
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
          <Flex
            border="1px solid lightgrey"
            boxShadow="2px 0px 7px rgba(0,0,0,0.2)"
            backgroundColor="white"
          >
            <GutterContent slotMetrics={slotMetrics} />
          </Flex>
        ) : null}
      </DragOverlay>
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
