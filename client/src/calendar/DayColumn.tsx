import React from 'react'
import clsx from 'clsx'

import Popover from '../lib/popover/Popover'
import { PopoverInfo } from '../lib/popover/index'

import SlotMetrics from './utils/SlotMetrics'
import getStyledEvents from './utils/DayEventLayout'
import { timeRangeFormat } from '../util/localizer'
import * as dates from '../util/dates'
import { Selection, SelectRect, EventData, getBoundsForNode, isEvent } from '../util/Selection'

import TimeSlotGroup from './TimeSlotGroup'
import TimeGridEvent from './TimeGridEvent'
import EventModal from './EventModal'
import Event from '../models/Event'

import DragDropEventContainer from './DragDropEventContainer'
import { EventActionContext } from './EventActionContext'

interface IProps {
  date: Date
  step: number
  timeslots: number
  min: Date
  max: Date
  events: Event[]
}

interface IState {
  selecting: boolean
  selectRange?: SelectRange
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
 * Renders the day column and handles click & drag to create a new event.
 */
class DayColumn extends React.Component<IProps, IState> {
  private dayRef
  private initialSlot
  private selection?: Selection
  private slotMetrics: SlotMetrics

  static contextType = EventActionContext

  constructor(props: IProps) {
    super(props)
    this.slotMetrics = new SlotMetrics(props.min, props.max, props.step, props.timeslots)
    this.dayRef = React.createRef()

    this.state = {
      selecting: false,
      selectRange: undefined,
    }

    this.initSelection = this.initSelection.bind(this)
    this.selectionState = this.selectionState.bind(this)
    this.handleSelectProgress = this.handleSelectProgress.bind(this)
  }

  componentDidMount() {
    this.initSelection()
  }

  componentWillUnmount() {
    if (this.selection) {
      this.selection.teardown()
    }
  }

  renderEventDialog(args: PopoverInfo) {
    return <EventModal />
  }

  renderEvents(slotMetrics) {
    const { events, step, timeslots } = this.props

    // TODO: Drag & Drop Container
    const styledEvents = getStyledEvents(events, Math.ceil((step * timeslots) / 2), slotMetrics)

    const dnd = this.context?.dragAndDropAction
    return styledEvents.map(({ event, style }, idx) => {
      const label = timeRangeFormat(event.start, event.end)
      const isInteracting = dnd && dnd.interacting && dnd.event.id === event.id

      if (event.creating && !isInteracting) {
        return (
          <Popover
            key={`evt_${idx}`}
            containerClassName={'cal-event-modal-container'}
            content={this.renderEventDialog}
            isOpen={true}
            position={['right', 'left']}
            onClickOutside={this.context?.onCancelSelection}
            padding={5}
          >
            <TimeGridEvent event={event} label={label} style={style} isPreview={false} />
          </Popover>
        )
      } else {
        return (
          <TimeGridEvent
            key={`evt_${idx}`}
            event={event}
            label={label}
            style={style}
            isPreview={false}
          />
        )
      }
    })
  }

  selectionState(rect: SelectRect): SelectRange | undefined {
    const { current } = this.dayRef

    if (!current) return

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
          return false
        }

        return !isEvent(current, point.clientX, point.clientY)
      })

      selection.on('select', () => {
        if (this.state.selecting) {
          this.setState({ selecting: false })
          if (this.state.selectRange) {
            console.log('Handle Select Event')
            const { startDate, endDate } = this.state.selectRange
            this.context?.onSelectNewEvent(startDate, endDate)
          }
        }
      })

      selection.on('click', (clickEvent: EventData) => {
        console.log('Handle click!')
        this.setState({ selecting: false })
      })

      selection.on('reset', () => {
        this.context?.onCancelSelection()
        this.setState({ selecting: false })
      })
    }
  }

  render() {
    const { selecting, selectRange } = this.state

    return (
      <div ref={this.dayRef} className={clsx('cal-day-slot', 'cal-time-column')}>
        {this.slotMetrics.groups.map((group, idx) => (
          <TimeSlotGroup key={`timeslot-${idx}`} group={group} />
        ))}

        <DragDropEventContainer slotMetrics={this.slotMetrics}>
          <div className="cal-events-container">{this.renderEvents(this.slotMetrics)}</div>
        </DragDropEventContainer>

        {selecting && selectRange && (
          <div
            className="cal-slot-selection"
            style={{ top: `${selectRange.top}%`, height: `${selectRange.height}%` }}
          >
            <span>{timeRangeFormat(selectRange.startDate, selectRange.endDate)}</span>
          </div>
        )}
      </div>
    )
  }
}

export default DayColumn
