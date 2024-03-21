import React, { ReactElement } from 'react'
import { Text, Box, Flex } from '@chakra-ui/react'
import {
  Portal,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
} from '@chakra-ui/react'

import { DateTime } from 'luxon'
import { formatFullDate } from '@/util/localizer-luxon'
import { eventLevels, EventSegment } from './utils/eventLevels'
import { renderSpan, EventItem } from './EventRow'
import { EventService } from './event-edit/useEventService'
import useEventActions from '@/state/useEventActions'

interface IProps {
  segments: EventSegment[]
  slots: number
  now: DateTime
  eventService: EventService
  onShowMore?: () => void
}

let isSegmentInSlot = (seg: EventSegment, slot: number) => seg.left <= slot && seg.right >= slot
export const eventsInSlot = (segments: EventSegment[], slot: number) =>
  segments.filter((seg) => isSegmentInSlot(seg, slot))

function range(start: number, count: number) {
  return Array.from(Array(count), (_, i) => start + i)
}

function InnerPopoverContent(props: {
  segments: EventSegment[]
  slot: number
  now: DateTime
  eventService: EventService
}) {
  const events = eventsInSlot(props.segments, props.slot).map((seg) => seg.event)

  return (
    <>
      <PopoverHeader fontSize="sm">{formatFullDate(events[0].start)}</PopoverHeader>
      <PopoverArrow />
      <PopoverCloseButton />
      <Flex direction="column" pb="1" pt="1">
        {events.map((e, idx) => {
          return (
            <Box className="cal-row-segment" key={`evt_${idx}`}>
              <EventItem
                isPreview={false}
                event={e}
                now={props.now}
                eventService={props.eventService}
              />
            </Box>
          )
        })}
      </Flex>
    </>
  )
}

export default function EventEndingRow(props: IProps) {
  const eventActions = useEventActions()

  function canRenderSlotEvent(slot: number, span: number) {
    return range(slot, span).every((s) => {
      let count = eventsInSlot(props.segments, s).length

      return count === 1
    })
  }

  function renderShowMore(segments: EventSegment[], slot: number) {
    let count = eventsInSlot(segments, slot).length

    if (props.onShowMore) {
      return (
        <Text color="gray.600" fontSize="xs" className="cal-event-row" onClick={props.onShowMore}>
          {count} more
        </Text>
      )
    } else {
      return (
        <Popover isLazy={true} closeOnBlur={false}>
          <PopoverTrigger>
            <Text
              color="gray.600"
              fontSize="xs"
              className="cal-event-row"
              onClick={(e) => {
                eventActions.cancelSelect()
              }}
            >
              {count} more
            </Text>
          </PopoverTrigger>

          <Portal>
            <PopoverContent>
              <InnerPopoverContent
                slot={slot}
                segments={props.segments}
                now={props.now}
                eventService={props.eventService}
              />
            </PopoverContent>
          </Portal>
        </Popover>
      )
    }
  }

  const rowSegments = eventLevels(props.segments).levels[0]
  let current = 1,
    lastEnd = 1
  const row: ReactElement[] = []

  const { slots } = props

  while (current <= slots) {
    let key = '_lvl_' + current

    let { event, left, right, span } =
      rowSegments.filter((seg) => isSegmentInSlot(seg, current))[0] || {} //eslint-disable-line

    if (!event) {
      current++
      continue
    }

    let gap: number = Math.max(0, left - lastEnd)

    if (canRenderSlotEvent(left, span)) {
      let content = (
        <EventItem
          isPreview={false}
          event={event}
          now={props.now}
          eventService={props.eventService}
        />
      )

      if (gap) {
        row.push(renderSpan(slots, gap, key + '_gap'))
      }

      row.push(renderSpan(slots, span, key, content))

      lastEnd = current = right + 1
    } else {
      if (gap) {
        row.push(renderSpan(slots, gap, key + '_gap'))
      }

      row.push(renderSpan(slots, 1, key, renderShowMore(props.segments, current)))
      lastEnd = current = current + 1
    }
  }

  return <div className="cal-row">{row}</div>
}
