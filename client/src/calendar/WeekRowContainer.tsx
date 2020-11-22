import React from 'react'

import * as dates from '../util/dates'
import Event from '../models/Event'
import DateSlotMetrics from './utils/DateSlotMetrics'
import EventRow from './EventRow'
import { EventSegment, eventSegments } from './utils/eventLevels'

import { EventActionContext } from './EventActionContext'
import { Selection, SelectRect, Rect, getBoundsForNode } from '../util/Selection'
import { pointInBox, getSlotAtX } from '../util/selection-utils'
import { fullDayFormat } from '../util/localizer'

interface IProps {
  children: any
  dayMetrics: DateSlotMetrics
  onUpdatedEvent: (Event) => void
  rowClassname: string
  wrapperClassname: string
}

interface IState {
  segment?: EventSegment
}

/**
 * Drag and drop container for the week row.
 */
class WeekRowContainer extends React.Component<IProps, IState> {
  private _selection?: Selection
  context!: React.ContextType<typeof EventActionContext>
  static contextType = EventActionContext
  private rowBodyRef: React.RefObject<HTMLDivElement>

  constructor(props) {
    super(props)
    this.state = {
      segment: undefined,
    }

    this.updateEvent = this.updateEvent.bind(this)
    this.initSelection = this.initSelection.bind(this)
    this.rowBodyRef = React.createRef()
  }

  componentDidMount() {
    this.initSelection()
  }

  componentWillUnmount() {
    this._selection?.teardown()
    this._selection = undefined
  }

  private updateEvent(
    event: Event,
    start: Date,
    end: Date,
    startDay: string | null,
    endDay: string | null
  ) {
    const updatedEvent = {
      ...event,
      start: start,
      end: end,
      start_day: startDay,
      end_day: endDay,
    }
    const segment = eventSegments(updatedEvent, this.props.dayMetrics.range)

    const { segment: lastSegment } = this.state
    if (
      lastSegment &&
      segment.span === lastSegment.span &&
      segment.left === lastSegment.left &&
      segment.right === lastSegment.right
    ) {
      return
    }

    this.setState({ segment })
  }

  private handleMove(point: SelectRect, bounds: Rect) {
    const event = this.context.dragAndDropAction?.event
    if (!event) {
      this.reset()
      return
    }

    if (!pointInBox(bounds, point.x, point.y)) {
      this.reset()
      return
    }

    const startDay = this.props.dayMetrics.getDateForSlot(
      getSlotAtX(bounds, point.x, false, this.props.dayMetrics.slots)
    )
    let start = dates.merge(startDay, event.start)
    let end = dates.add(start, dates.diff(event.start, event.end, 'minutes'), 'minutes')

    if (event.all_day) {
      let endDay = dates.add(startDay, dates.diff(event.start, event.end, 'day'), 'day')
      this.updateEvent(event, start, end, fullDayFormat(startDay), fullDayFormat(endDay))
    } else {
      this.updateEvent(event, start, end, null, null)
    }
  }

  private reset() {
    this.setState({ segment: undefined! })
  }

  private initSelection() {
    const { current } = this.rowBodyRef

    if (current) {
      const rowContainer = current.closest(`.${this.props.rowClassname}`) as HTMLElement
      const container = current.closest(`.${this.props.wrapperClassname}`) as HTMLElement

      if (rowContainer && container) {
        const selection = (this._selection = new Selection(container))

        selection.on('beforeSelect', (point: SelectRect) => {
          const dragAndDropAction = this.context.dragAndDropAction!
          if (!dragAndDropAction) {
            return false
          }

          console.log(`beforeSelect`)
          console.log(this.context.dragAndDropAction)
        })

        selection.on('selecting', (point: SelectRect) => {
          const bounds = getBoundsForNode(rowContainer)

          if (this.context.dragAndDropAction?.action === 'MOVE') {
            this.handleMove(point, bounds)
          }
        })

        selection.on('select', (point: SelectRect) => {
          const bounds = getBoundsForNode(rowContainer)
          if (!this.state.segment || !pointInBox(bounds, point.x, point.y)) {
            return
          }

          const { event } = this.state.segment
          this.context.onEnd(event)
          this.props.onUpdatedEvent(event)
          this.reset()
        })

        selection.on('selectStart', () => this.context.onStart())

        selection.on('click', () => this.context.onEnd(null))

        selection.on('reset', () => {
          this.reset()
          this.context.onEnd()
          this.context?.eventDispatch({ type: 'CANCEL_SELECT' })
        })
      }
    }
  }

  render() {
    return (
      <div ref={this.rowBodyRef} className="cal-dnd-row-body">
        {this.props.children}

        {this.state.segment && (
          <EventRow
            className={'cal-dnd-row'}
            segments={[this.state.segment]}
            slotMetrics={this.props.dayMetrics}
            isPreview={true}
          />
        )}
      </div>
    )
  }
}

export default WeekRowContainer
