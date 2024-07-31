import React, { useState } from 'react'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { DragOverlay } from '@dnd-kit/core'
import { SortableGutter } from './SortableGutter'
import { Flex } from '@chakra-ui/react'
import GutterContent from './GutterContent'
const GUTTER_LINE_WIDTH = 0.5

/**
 * The `Gutter` component serves as a container for sortable gutters.
 * Sorting horizontially
 */

const Gutter = ({ slotMetrics, gutterRef, timezones, activeTimezoneId }) => {
  const activeTimezone = timezones.find((tz) => tz.id === activeTimezoneId)

  return (
    <Flex direction={'row'} className="cal-gutter">
      <SortableContext
        items={timezones.map((gutter) => gutter.id)}
        strategy={horizontalListSortingStrategy}
      >
        {/* Creates a reversed copy of the timezone state to ensure the primary time is closest to
        the calendar. */}
        {timezones.toReversed().map((timezone) => (
          <SortableGutter
            key={timezone.id}
            timezone={timezone}
            id={timezone.id}
            slotMetrics={slotMetrics}
            gutterRef={gutterRef}
          />
        ))}
      </SortableContext>
      <DragOverlay>
        {activeTimezoneId ? (
          <Flex
            border="1px solid"
            borderColor={'blackAlpha.400'}
            boxShadow="2px 0px 7px rgba(0,0,0,0.2)"
            backgroundColor={'white'}
          >
            <GutterContent slotMetrics={slotMetrics} timezone={activeTimezone} />
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
export default Gutter
