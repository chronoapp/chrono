import React from 'react'
import {
  Selection,
  Rect,
  EventData,
  getBoundsForNode,
  getEventNodeFromPoint,
  SelectRect,
} from '../util/Selection'

import TimeGridEvent from './TimeGridEvent'
import * as dates from '../util/dates'
import { timeRangeFormat } from '../util/localizer'
import { EventActionContext, DragDropAction } from './EventActionContext'
import Event from '../models/Event'
import SlotMetrics from './utils/SlotMetrics'

interface IProps {
  slotMetrics: SlotMetrics
  children: any
  onEventUpdated: (event: Event) => void
}

interface IState {
  event: Event | null
  top: number
  height: number
}

function pointInColumn(bounds: Rect, x: number, y: number): boolean {
  return x < bounds.right + 10 && x > bounds.left && y > bounds.top
}

/**
 * Handles drag & drop and resizing of existing events.
 */
class DragDropEventContainer extends React.Component<IProps, IState> {
  private containerRef
  private selection?: Selection

  // Cursor offset from top of the event.
  private eventOffsetTop: number = 0
  private isBeingDragged: boolean = false

  context!: React.ContextType<typeof EventActionContext>
  static contextType = EventActionContext

  constructor(props) {
    super(props)

    this.containerRef = React.createRef()
    this.initSelection = this.initSelection.bind(this)
    this.reset = this.reset.bind(this)
    this.updateEvent = this.updateEvent.bind(this)

    this.state = {
      event: null,
      top: 0,
      height: 0,
    }
  }

  componentDidMount() {
    this.initSelection()
  }

  componentWillUnmount() {
    this.selection?.teardown()
  }

  private updateEvent(event: Event, startDate: Date, endDate: Date, top: number, height: number) {
    const { event: lastEvent } = this.state
    if (lastEvent && startDate === lastEvent.start && endDate === lastEvent.end) {
      return
    }

    const nextEvent = { ...event, start: startDate, end: endDate }
    this.setState({
      top,
      height,
      event: nextEvent,
    })
  }

  private handleResize(point: SelectRect, bounds: Rect) {
    const { event, direction } = this.context.dragAndDropAction!
    const { slotMetrics } = this.props

    const currentSlot = slotMetrics.closestSlotFromPoint(point.y, bounds)

    let start
    let end
    if (direction === 'UP') {
      end = event.end
      start = dates.min(currentSlot, slotMetrics.closestSlotFromDate(end, -1))
    } else if (direction === 'DOWN') {
      start = event.start
      end = dates.max(currentSlot, slotMetrics.closestSlotFromDate(start))
    }

    const range = slotMetrics.getRange(start, end)
    this.updateEvent(event, range.startDate, range.endDate, range.top, range.height)
  }

  private handleMove(point: SelectRect, bounds: Rect) {
    const { event } = this.context.dragAndDropAction!
    const { slotMetrics } = this.props

    if (!pointInColumn(bounds, point.x, point.y)) {
      this.reset()
      return
    }

    const currentSlot = slotMetrics.closestSlotFromPoint(point.y - this.eventOffsetTop, bounds)

    const end = dates.add(currentSlot, dates.diff(event.start, event.end, 'minutes'), 'minutes')
    const range = slotMetrics.getRange(currentSlot, end, false, true)

    this.updateEvent(event, range.startDate, range.endDate, range.top, range.height)
  }

  private reset() {
    if (this.state.event) {
      this.setState({ event: null, top: 0, height: 0 })
    }
  }

  private initSelection() {
    const { current } = this.containerRef

    if (current) {
      const node = current
      const selection = (this.selection = new Selection(node.closest('.cal-time-view')))

      selection.on('beforeSelect', (point: EventData) => {
        const dragAndDropAction: DragDropAction = this.context.dragAndDropAction!
        if (!dragAndDropAction) {
          return false
        }

        if (dragAndDropAction.action === 'RESIZE') {
          return pointInColumn(getBoundsForNode(node), point.x, point.y)
        }

        const eventNode = getEventNodeFromPoint(node, point.clientX, point.clientY)
        if (!eventNode) {
          return false
        }

        this.eventOffsetTop = point.y - getBoundsForNode(eventNode as HTMLElement).top
      })

      selection.on('selecting', (point: SelectRect) => {
        const bounds = getBoundsForNode(node)
        const { dragAndDropAction } = this.context

        if (dragAndDropAction!.action === 'RESIZE') {
          this.handleResize(point, bounds)
        } else if (dragAndDropAction!.action === 'MOVE') {
          this.handleMove(point, bounds)
        }
      })

      selection.on('selectStart', () => {
        this.isBeingDragged = true
        this.context.onStart()
      })

      selection.on('select', (point) => {
        const bounds = getBoundsForNode(node)
        this.isBeingDragged = false

        if (!this.state.event || !pointInColumn(bounds, point.x, point.y)) {
          return
        }

        const { event } = this.state
        this.reset()

        this.context.onEnd(event)
        this.props.onEventUpdated(event)
      })

      selection.on('click', () => {
        if (this.isBeingDragged) {
          this.reset()
        }

        this.context.onEnd()
      })

      selection.on('reset', () => {
        this.reset()
        this.context.onEnd()
      })
    }
  }

  public render() {
    const events = this.props.children.props.children
    const { event, top, height } = this.state

    return React.cloneElement(this.props.children, {
      ref: this.containerRef,
      children: (
        <div ref={this.containerRef}>
          {events}
          {event && (
            <TimeGridEvent
              event={event}
              label={timeRangeFormat(event.start, event.end)}
              style={{ top, height, width: 100, xOffset: 0, border: 'none' }}
              isPreview={true}
            />
          )}
        </div>
      ),
    })
  }
}

export default DragDropEventContainer