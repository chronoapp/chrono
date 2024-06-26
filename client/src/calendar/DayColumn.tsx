import ReactDOM from 'react-dom'
import { useRef, useState, useEffect } from 'react'
import { usePopper } from 'react-popper'

import clsx from 'clsx'

import { Box, Flex } from '@chakra-ui/react'

import { ChronoUnit, ZonedDateTime as DateTime } from '@js-joda/core'
import { formatTimeRange, formatTimeShort } from '@/util/localizer-joda'
import * as dates from '@/util/dates-joda'

import { withEventActions, InjectedEventActionsProps } from '@/state/withEventActions'
import { Selection, SelectRect, EventData, getBoundsForNode, isEvent } from '@/util/Selection'
import Event, { EMPTY_TITLE } from '@/models/Event'
import Calendar from '@/models/Calendar'

import SlotMetrics from './utils/SlotMetrics'
import getStyledEvents from './utils/DayEventLayout'
import TimeSlotGroup from './TimeSlotGroup'
import TimeGridEvent from './TimeGridEvent'
import EventPopover from './event-edit/EventEditPopover'
import ResizeEventContainer from './ResizeEventContainer'
import { EventService } from '@/calendar/event-edit/useEventService'

import { darkenColor18 } from './utils/Colors'
import { EventVerticalIndicator } from '@/components/EventStyle'

interface IProps {
  date: DateTime
  step: number
  timeslots: number
  min: DateTime
  max: DateTime
  events: Event[]
  isCurrentDay: boolean
  now: DateTime
  eventService: EventService
  primaryCalendar: Calendar
}

class SelectRange {
  constructor(
    readonly top: number,
    readonly height: number,
    readonly start: number,
    readonly startDate: DateTime,
    readonly end: number,
    readonly endDate: DateTime
  ) {}
}

/**
 * 1) Renders the day column
 * 2) Handles click & drag to create a new event.
 */
function DayColumn(props: IProps & InjectedEventActionsProps) {
  const selectingRef = useRef(false)
  const [_selecting, _setSelecting] = useState(false)

  const selectRangeRef = useRef<SelectRange | undefined>(undefined)
  const [_selectRange, _setSelectRange] = useState<SelectRange | undefined>(undefined)

  const slotMetricsRef = useRef<SlotMetrics>(
    new SlotMetrics(props.min, props.max, props.step, props.timeslots)
  )
  const dayRef = useRef<HTMLDivElement>(null)

  const initialSlotRef = useRef<DateTime>()
  const selectionRef = useRef<Selection>()
  const hasJustCancelledEventCreateRef = useRef(false)

  // Event edit popover
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
  const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'auto',
  })

  const timeIndicatorPosition = slotMetricsRef.current.getCurrentTimePosition(props.now)

  /**
   * State updater functions. Since we use Selection object which uses event listeners for Select events
   * our state will be stale. So we use refs to keep track of the latest state.
   * */

  const setSelecting = (selecting: boolean) => {
    selectingRef.current = selecting
    _setSelecting(selecting)
  }

  const setSelectRange = (selectRange: SelectRange | undefined) => {
    selectRangeRef.current = selectRange
    _setSelectRange(selectRange)
  }

  // Handle prop changes (equivalent to UNSAFE_componentWillReceiveProps)

  useEffect(() => {
    slotMetricsRef.current = new SlotMetrics(props.min, props.max, props.step, props.timeslots)
  }, [props.min, props.max, props.step, props.timeslots])

  useEffect(() => {
    selectionRef.current = initSelection()

    return () => {
      if (selectionRef.current) {
        selectionRef.current.teardown()
      }
    }
  }, [props.editingEvent, props.dragAndDropAction, props.primaryCalendar])

  function getContainerRef() {
    return dayRef
  }

  function renderEventEditPopover() {
    if (props.editingEvent && referenceElement) {
      const { event } = props.editingEvent

      const isInDay = dates.gte(event.start, props.min) && dates.lte(event.start, props.max)
      const isTailSegment = isTailEndofMultiDayEvent(event)
      const isSegmentSelected =
        (props.editingEvent.selectTailSegment && isTailSegment) ||
        (!props.editingEvent.selectTailSegment && !isTailSegment && isInDay)

      if (isSegmentSelected) {
        return ReactDOM.createPortal(
          <Box
            ref={(node) => setPopperElement(node)}
            style={styles.popper}
            {...attributes.popper}
            bg="white"
            width="xs"
            maxH="3xl"
            zIndex={10}
            border="0.5px solid rgba(82, 82, 100, 0.3)"
            borderRadius="md"
          >
            <EventPopover event={event} eventService={props.eventService} />
          </Box>,
          document.body
        )
      }
    }

    return <></>
  }

  function renderEvents(slotMetrics) {
    const { events, step, now } = props

    const styledEvents = getStyledEvents(events, step, slotMetrics)

    const dnd = props.dragAndDropAction
    const editingEvent = props.editingEvent

    return styledEvents.map(({ event, style }, idx) => {
      const label = formatTimeRange(event.start, event.end)
      const isInteracting =
        dnd &&
        dnd.interacting &&
        dnd.event.id === event.id &&
        dnd.event.calendar_id === event.calendar_id

      const isTailSegment = isTailEndofMultiDayEvent(event)
      const isSegmentSelected =
        (editingEvent?.selectTailSegment && isTailSegment) ||
        (!editingEvent?.selectTailSegment && !isTailSegment)

      const showEditingPopover =
        editingEvent?.id === event.id &&
        editingEvent?.event?.calendar_id === event.calendar_id &&
        (editingEvent?.editMode == 'READ' || editingEvent?.editMode == 'EDIT') &&
        isSegmentSelected

      return (
        <TimeGridEvent
          key={`evt_${idx}`}
          now={now}
          event={event}
          label={label}
          style={style}
          isPreview={false}
          isTailSegment={isTailSegment}
          getContainerRef={getContainerRef}
          ref={
            showEditingPopover && !isInteracting ? (node) => setReferenceElement(node) : undefined
          }
        />
      )
    })
  }

  function isTailEndofMultiDayEvent(event: Event): boolean {
    return dates.lt(event.start, props.min) && dates.gte(event.end, props.min)
  }

  function selectionState(rect: SelectRect): SelectRange | undefined {
    const { current } = dayRef
    if (!current) {
      return
    }

    let currentSlot = slotMetricsRef.current.closestSlotFromPoint(rect.y, getBoundsForNode(current))
    if (!selectingRef.current) {
      initialSlotRef.current = currentSlot
    }

    let initialSlot = initialSlotRef.current
    if (!initialSlot) {
      return
    }

    if (dates.lte(initialSlot, currentSlot)) {
      currentSlot = slotMetricsRef.current.nextSlot(currentSlot)
    } else if (dates.gt(initialSlot, currentSlot)) {
      initialSlot = slotMetricsRef.current.nextSlot(initialSlot)
    }

    const selectRange = slotMetricsRef.current.getRange(
      dates.min(initialSlot, currentSlot),
      dates.max(initialSlot, currentSlot),
      true,
      true
    )

    // TODO: slotMetrics returns this.
    return new SelectRange(
      selectRange.top,
      selectRange.height,
      selectRange.start,
      selectRange.startDate,
      selectRange.end,
      selectRange.endDate
    )
  }

  function handleSelectProgress(rect: SelectRect) {
    const state = selectionState(rect)

    if (state) {
      if (
        !selectRangeRef.current ||
        !selectingRef.current ||
        selectRangeRef.current.start !== state.start ||
        selectRangeRef.current.end !== state.end
      ) {
        setSelecting(true)
        setSelectRange(state)
      }
    }
  }

  function initSelection() {
    const dayWrapperRef = dayRef.current

    if (dayWrapperRef) {
      const selection = new Selection(dayWrapperRef)

      selection.on('selectStart', handleSelectProgress)
      selection.on('selecting', handleSelectProgress)

      selection.on('beforeSelect', (point: EventData) => {
        if (props.dragAndDropAction) {
          // Already handled by DragDropEventContainer.
          return false
        }

        if (props.editingEvent) {
          props.eventActions.cancelSelect()
          hasJustCancelledEventCreateRef.current = true
        }

        return !isEvent(dayWrapperRef, point.clientX, point.clientY)
      })

      selection.on('select', () => {
        if (selectingRef.current) {
          setSelecting(false)

          if (selectRangeRef.current) {
            const { startDate, endDate } = selectRangeRef.current
            setSelectRange(undefined)

            const calendar = props.primaryCalendar
            props.eventActions.initNewEventAtDate(calendar, false, startDate, endDate)
          }
        }
      })

      selection.on('click', (clickEvent: EventData) => {
        if (hasJustCancelledEventCreateRef.current) {
          // Makes sure we don't create an event immediately after cancelling.
          hasJustCancelledEventCreateRef.current = false
          setSelecting(false)
          return
        }

        const { current } = dayRef
        if (!current) {
          return
        }

        const startDate = slotMetricsRef.current.closestSlotFromPoint(
          clickEvent.y,
          getBoundsForNode(current)
        )
        props.eventActions.initNewEventAtDate(props.primaryCalendar, false, startDate)
        setSelecting(false)
      })

      selection.on('reset', () => {
        props.eventActions.cancelSelect()
        setSelecting(false)
      })

      return selection
    }
  }

  function renderSelection(selectRange: SelectRange) {
    const diffMin = dates.diff(selectRange.endDate, selectRange.startDate, ChronoUnit.MINUTES)

    let inner
    if (diffMin <= 30) {
      inner = (
        <Flex
          className={clsx('cal-event-content', diffMin <= 15 && 'cal-small-event', 'cal-ellipsis')}
          style={{ lineHeight: '12px', paddingLeft: '10px' }}
        >
          <span>{EMPTY_TITLE}</span>
          <span style={{ fontSize: '90%', flex: 1 }}>
            {`, ${formatTimeShort(selectRange.startDate)}`}
          </span>
        </Flex>
      )
    } else {
      inner = [
        <div key="1" className="cal-event-content" style={{ paddingLeft: '10px' }}>
          {EMPTY_TITLE}
        </div>,
        <div key="2" className="cal-event-label" style={{ paddingLeft: '10px' }}>
          {formatTimeRange(selectRange.startDate, selectRange.endDate)}
        </div>,
      ]
    }
    const backgroundColor = Event.getBackgroundColor(
      selectRange.endDate,
      props.primaryCalendar.backgroundColor,
      props.now
    )
    const foregroundColor = Event.getForegroundColor(
      selectRange.endDate,
      props.now,
      props.primaryCalendar.backgroundColor
    )
    return (
      <div
        className={'cal-slot-selection'}
        style={{
          top: `${selectRange.top}%`,
          height: `${selectRange.height}%`,
          color: darkenColor18(foregroundColor),
          backgroundColor: backgroundColor,
          padding: 'unset',
        }}
      >
        <EventVerticalIndicator color={foregroundColor} />
        {inner}
      </div>
    )
  }

  return (
    <div ref={dayRef} className={clsx('cal-day-slot', 'cal-time-column')}>
      {slotMetricsRef.current.groups.map((group, idx) => (
        <TimeSlotGroup key={`timeslot-${idx}`} group={group} />
      ))}

      <ResizeEventContainer
        now={props.now}
        onEventUpdated={props.eventService.moveOrResizeEvent}
        slotMetrics={slotMetricsRef.current}
      >
        <div className="cal-events-container">{renderEvents(slotMetricsRef.current)}</div>
      </ResizeEventContainer>

      {selectingRef.current && selectRangeRef.current && renderSelection(selectRangeRef.current)}
      {props.isCurrentDay && (
        <div className="cal-current-time-indicator" style={{ top: `${timeIndicatorPosition}%` }}>
          <div className="cal-current-time-circle" />
        </div>
      )}

      {renderEventEditPopover()}
    </div>
  )
}

export default withEventActions(DayColumn)
