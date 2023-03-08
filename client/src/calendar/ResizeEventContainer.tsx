import React from 'react'

import { DragDropAction } from '@/state/EventsState'
import { withEventActions, InjectedEventActionsProps } from '@/state/withEventActions'
import Event from '@/models/Event'

import * as dates from '../util/dates'
import { timeRangeFormat } from '../util/localizer'
import SlotMetrics from './utils/SlotMetrics'
import { GlobalEvent } from '../util/global'
import { Selection, Rect, EventData, getBoundsForNode, SelectRect } from '../util/Selection'

import TimeGridEvent from './TimeGridEvent'

const GRID_WRAPPER_SELECTOR = '.cal-time-view'

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
 * Handles Resizing of existing events.
 */
class ResizeEventContainer extends React.Component<IProps & InjectedEventActionsProps, IState> {
  private containerRef
  private selection?: Selection

  constructor(props) {
    super(props)

    this.containerRef = React.createRef()
    this.initSelection = this.initSelection.bind(this)
    this.reset = this.reset.bind(this)
    this.updateEvent = this.updateEvent.bind(this)
    this.getContainerRef = this.getContainerRef.bind(this)
    this.getOffsetFromTopOfEvent = this.getOffsetFromTopOfEvent.bind(this)

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

  private getContainerRef() {
    return this.containerRef
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
    const { event, direction } = this.props.dragAndDropAction!
    const { slotMetrics } = this.props

    const currentSlot = slotMetrics.closestSlotFromPoint(point.y, bounds, true)

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
    this.updateEvent(event, start, dates.round(range.endDate), range.top, range.height)
  }

  private reset() {
    if (this.state.event) {
      this.setState({ event: null, top: 0, height: 0 })
    }
  }

  private getOffsetFromTopOfEvent(point: EventData, eventNode: HTMLElement, event?: Event) {
    const bounds = getBoundsForNode(eventNode)
    const eventTop = bounds.top
    const cutoffDate = this.props.slotMetrics.start

    if (event && event.start < cutoffDate && event.end > cutoffDate) {
      const eventHeight = bounds.bottom - bounds.top
      const totalEventMinutes = dates.diff(event.start, event.end, 'minutes')
      const overflowMinutes = dates.diff(cutoffDate, event.start, 'minutes')
      const unitsPerMinute = eventHeight / (totalEventMinutes - overflowMinutes)
      const overflowHeight =
        unitsPerMinute * totalEventMinutes * (overflowMinutes / totalEventMinutes)

      return point.y - (eventTop - overflowHeight)
    } else {
      return point.y - eventTop
    }
  }

  private initSelection() {
    const { current } = this.containerRef

    if (current) {
      const node = current
      const selection = (this.selection = new Selection(node.closest(GRID_WRAPPER_SELECTOR)))

      selection.on('beforeSelect', (point: EventData) => {
        const dragAndDropAction: DragDropAction = this.props.dragAndDropAction!

        if (dragAndDropAction?.action === 'RESIZE') {
          return pointInColumn(getBoundsForNode(node), point.x, point.y)
        } else {
          // Let DragDropZone handle moving events.
          // So, don't add more event listeners here.
          return false
        }
      })

      selection.on('selectStart', () => {
        this.props.eventActions.onInteractionStart()
      })

      selection.on('selecting', (point: SelectRect) => {
        const dragAndDropAction = this.props.dragAndDropAction

        // Don't drag full day events to the grid.
        if (dragAndDropAction?.event.all_day) {
          return
        }

        if (dragAndDropAction?.action === 'RESIZE') {
          const bounds = getBoundsForNode(node)
          this.handleResize(point, bounds)
        }
      })

      selection.on('select', (point) => {
        const { event } = this.state
        if (!event) {
          return
        }

        this.reset()
        this.props.eventActions.onInteractionEnd()
        this.props.onEventUpdated(event)

        if (event.start < this.props.slotMetrics.start && event.syncStatus === 'NOT_SYNCED') {
          document.dispatchEvent(
            new CustomEvent(GlobalEvent.scrollToEvent, { detail: event.start })
          )
        }
      })

      selection.on('click', () => {
        this.props.eventActions.onInteractionEnd()
      })

      selection.on('reset', () => {
        this.reset()
        this.props.eventActions.onInteractionEnd()
      })
    }
  }

  public render() {
    const events = this.props.children.props.children
    const { event, top, height } = this.state
    const today = new Date()

    return React.cloneElement(this.props.children, {
      ref: this.containerRef,
      children: (
        <div ref={this.containerRef}>
          {events}
          {event && (
            <TimeGridEvent
              now={today}
              event={event}
              label={timeRangeFormat(event.start, event.end)}
              style={{ top, height, width: 100, xOffset: 0, border: 'none' }}
              isPreview={true}
              getContainerRef={this.getContainerRef}
            />
          )}
        </div>
      ),
    })
  }
}

export default withEventActions(ResizeEventContainer)
