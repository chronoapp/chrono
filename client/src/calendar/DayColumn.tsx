import React from 'react'
import clsx from 'clsx'
import { Portal, Popover, PopoverTrigger, PopoverContent, PopoverArrow } from '@chakra-ui/react'

import { timeRangeFormat, timeFormatShort } from '@/util/localizer'
import * as dates from '@/util/dates'
import { Selection, SelectRect, EventData, getBoundsForNode, isEvent } from '@/util/Selection'
import Event, { EMPTY_TITLE } from '@/models/Event'

import SlotMetrics from './utils/SlotMetrics'
import getStyledEvents from './utils/DayEventLayout'
import TimeSlotGroup from './TimeSlotGroup'
import TimeGridEvent from './TimeGridEvent'
import EventPopover from './event-edit/EventPopover'

import ResizeEventContainer from './ResizeEventContainer'
import { EventActionContext } from './EventActionContext'
import { EventService } from '@/calendar/event-edit/useEventService'
import Calendar from '@/models/Calendar'

interface IProps {
  date: Date
  step: number
  timeslots: number
  min: Date
  max: Date
  events: Event[]
  isCurrentDay: boolean
  now: Date
  eventService: EventService
  getPrimaryCalendar: () => Calendar
}

interface IState {
  selecting: boolean
  selectRange?: SelectRange
  timeIndicatorPosition: number
}

class SelectRange {
  constructor(
    readonly top: number,
    readonly height: number,
    readonly start: number,
    readonly startDate: Date,
    readonly end: number,
    readonly endDate: Date
  ) {}
}

/**
 * 1) Renders the day column
 * 2) Handles click & drag to create a new event.
 */
class DayColumn extends React.Component<IProps, IState> {
  private dayRef
  private initialSlot
  private selection?: Selection
  private slotMetrics: SlotMetrics

  private timeIndicatorTimeout
  private intervalTriggered: boolean = false
  private hasJustCancelledEventCreate: boolean = false

  static contextType = EventActionContext
  context!: React.ContextType<typeof EventActionContext>

  constructor(props: IProps) {
    super(props)
    this.slotMetrics = new SlotMetrics(props.min, props.max, props.step, props.timeslots)
    this.dayRef = React.createRef()

    this.state = {
      selecting: false,
      selectRange: undefined,
      timeIndicatorPosition: 0,
    }

    this.initSelection = this.initSelection.bind(this)
    this.selectionState = this.selectionState.bind(this)
    this.handleSelectProgress = this.handleSelectProgress.bind(this)
    this.getContainerRef = this.getContainerRef.bind(this)
  }

  componentDidMount() {
    this.initSelection()
    if (this.props.isCurrentDay) {
      this.setTimeIndicatorPositionUpdateInterval()
    }
  }

  componentWillUnmount() {
    if (this.selection) {
      this.selection.teardown()
    }
    this.clearTimeIndicatorInterval()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.isCurrentDay != this.props.isCurrentDay) {
      this.clearTimeIndicatorInterval()

      if (this.props.isCurrentDay) {
        this.setTimeIndicatorPositionUpdateInterval()
      }
    }
  }

  UNSAFE_componentWillReceiveProps(props: IProps) {
    this.slotMetrics = new SlotMetrics(props.min, props.max, props.step, props.timeslots)
  }

  getContainerRef() {
    return this.dayRef
  }

  clearTimeIndicatorInterval() {
    this.intervalTriggered = false
    window.clearTimeout(this.timeIndicatorTimeout)
  }

  setTimeIndicatorPositionUpdateInterval() {
    if (!this.intervalTriggered) {
      this.updatePositionTimeIndicator()
    }

    this.timeIndicatorTimeout = window.setTimeout(() => {
      this.intervalTriggered = true
      this.updatePositionTimeIndicator()
      this.setTimeIndicatorPositionUpdateInterval()
    }, 60000)
  }

  updatePositionTimeIndicator() {
    const { min, max } = this.props
    const current = new Date()

    if (current >= min && current <= max) {
      const top = this.slotMetrics.getCurrentTimePosition(current)
      this.intervalTriggered = true
      this.setState({ timeIndicatorPosition: top })
    } else {
      this.clearTimeIndicatorInterval()
    }
  }

  renderEvents(slotMetrics) {
    const { events, step, now } = this.props

    const styledEvents = getStyledEvents(events, step, slotMetrics)

    const dnd = this.context?.dragAndDropAction
    const editingEvent = this.context?.eventState.editingEvent

    return styledEvents.map(({ event, style }, idx) => {
      const label = timeRangeFormat(event.start, event.end)
      const isInteracting =
        dnd &&
        dnd.interacting &&
        dnd.event.id === event.id &&
        dnd.event.calendar_id === event.calendar_id

      const isTailSegment = this.isTailEndofMultiDayEvent(event)
      const isSegmentSelected =
        (editingEvent?.selectTailSegment && isTailSegment) ||
        (!editingEvent?.selectTailSegment && !isTailSegment)

      const isEditing =
        editingEvent?.id === event.id &&
        editingEvent?.event?.calendar_id === event.calendar_id &&
        editingEvent?.editMode !== 'FULL_EDIT' &&
        isSegmentSelected

      if (isEditing && !isInteracting) {
        // TODO: Update the placement depending on the event's location.
        return (
          <Popover key={`evt_${idx}`} isOpen={true} isLazy={true} placement={'auto'}>
            <PopoverTrigger>
              <TimeGridEvent
                now={now}
                event={event}
                label={label}
                style={style}
                isPreview={false}
                isTailSegment={isTailSegment}
                getContainerRef={this.getContainerRef}
              />
            </PopoverTrigger>
            <Portal>
              <PopoverContent w="25em">
                <PopoverArrow />
                <EventPopover event={editingEvent!.event} eventService={this.props.eventService} />
              </PopoverContent>
            </Portal>
          </Popover>
        )
      } else {
        return (
          <TimeGridEvent
            key={`evt_${idx}`}
            now={now}
            event={event}
            label={label}
            style={style}
            isPreview={false}
            isTailSegment={isTailSegment}
            getContainerRef={this.getContainerRef}
          />
        )
      }
    })
  }

  isTailEndofMultiDayEvent(event: Event): boolean {
    return event.start < this.props.min && event.end >= this.props.min
  }

  selectionState(rect: SelectRect): SelectRange | undefined {
    const { current } = this.dayRef

    if (!current) {
      return
    }

    let currentSlot = this.slotMetrics.closestSlotFromPoint(rect.y, getBoundsForNode(current))

    if (!this.state.selecting) {
      this.initialSlot = currentSlot
    }

    let initialSlot = this.initialSlot
    if (dates.lte(initialSlot, currentSlot)) {
      currentSlot = this.slotMetrics.nextSlot(currentSlot)
    } else if (dates.gt(initialSlot, currentSlot)) {
      initialSlot = this.slotMetrics.nextSlot(initialSlot)
    }

    const selectRange = this.slotMetrics.getRange(
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

  handleSelectProgress(rect: SelectRect) {
    const state = this.selectionState(rect)
    const { selecting, selectRange } = this.state

    if (state) {
      if (
        !selectRange ||
        !selecting ||
        selectRange.start !== state.start ||
        selectRange.end !== state.end
      ) {
        this.setState({ selecting: true, selectRange: state })
      }
    }
  }

  initSelection() {
    const { current } = this.dayRef

    if (current) {
      const selection = (this.selection = new Selection(current))

      selection.on('selectStart', this.handleSelectProgress)
      selection.on('selecting', this.handleSelectProgress)

      selection.on('beforeSelect', (point: EventData) => {
        if (this.context?.dragAndDropAction) {
          // Already handled by DragDropEventContainer.
          return false
        }

        if (this.context?.eventState.editingEvent?.id) {
          this.context?.eventDispatch({ type: 'CANCEL_SELECT' })
          this.hasJustCancelledEventCreate = true
        }

        return !isEvent(current, point.clientX, point.clientY)
      })

      selection.on('select', () => {
        if (this.state.selecting) {
          this.setState({ selecting: false })

          if (this.state.selectRange) {
            console.log('Handle Select Event')
            const { startDate, endDate } = this.state.selectRange
            const event = Event.newDefaultEvent(
              this.props.getPrimaryCalendar().id,
              startDate,
              endDate,
              false
            )

            this.context?.eventDispatch({
              type: 'INIT_EDIT_NEW_EVENT',
              payload: event,
            })
          }
        }
      })

      selection.on('click', (clickEvent: EventData) => {
        if (this.hasJustCancelledEventCreate) {
          // Makes sure we don't create an event immediately after cancelling.
          this.hasJustCancelledEventCreate = false
          this.setState({ selecting: false })
          return
        }

        const { current } = this.dayRef
        if (!current) {
          return
        }

        const startDate = this.slotMetrics.closestSlotFromPoint(
          clickEvent.y,
          getBoundsForNode(current)
        )
        this.context?.eventDispatch({
          type: 'INIT_NEW_EVENT_AT_DATE',
          payload: {
            calendarId: this.props.getPrimaryCalendar().id,
            date: startDate,
            allDay: false,
          },
        })

        this.setState({ selecting: false })
      })

      selection.on('reset', () => {
        this.context?.eventDispatch({ type: 'CANCEL_SELECT' })
        this.setState({ selecting: false })
      })
    }
  }

  renderSelection(selectRange: SelectRange) {
    const diffMin = (selectRange.endDate.getTime() - selectRange.startDate.getTime()) / 60000
    let inner
    if (diffMin <= 30) {
      inner = (
        <div
          className={clsx(
            'cal-event-content',
            'is-flex',
            diffMin <= 15 && 'cal-small-event',
            'cal-ellipsis'
          )}
          style={{ lineHeight: '12px' }}
        >
          <span>{EMPTY_TITLE}</span>
          <span style={{ fontSize: '90%', flex: 1 }}>
            {`, ${timeFormatShort(selectRange.startDate)}`}
          </span>
        </div>
      )
    } else {
      inner = [
        <div key="1" className="cal-event-content">
          {EMPTY_TITLE}
        </div>,
        <div key="2" className="cal-event-label">
          {timeRangeFormat(selectRange.startDate, selectRange.endDate)}
        </div>,
      ]
    }

    return (
      <div
        className={'cal-slot-selection'}
        style={{
          top: `${selectRange.top}%`,
          height: `${selectRange.height}%`,
        }}
      >
        {inner}
      </div>
    )
  }

  render() {
    const { selecting, selectRange } = this.state

    return (
      <div ref={this.dayRef} className={clsx('cal-day-slot', 'cal-time-column')}>
        {this.slotMetrics.groups.map((group, idx) => (
          <TimeSlotGroup key={`timeslot-${idx}`} group={group} />
        ))}

        <ResizeEventContainer
          onEventUpdated={this.props.eventService.saveEvent}
          slotMetrics={this.slotMetrics}
        >
          <div className="cal-events-container">{this.renderEvents(this.slotMetrics)}</div>
        </ResizeEventContainer>

        {selecting && selectRange && this.renderSelection(selectRange)}
        {this.props.isCurrentDay && this.intervalTriggered && (
          <div
            className="cal-current-time-indicator"
            style={{ top: `${this.state.timeIndicatorPosition}%` }}
          >
            <div className="cal-current-time-circle" />
          </div>
        )}
      </div>
    )
  }
}

export default DayColumn
