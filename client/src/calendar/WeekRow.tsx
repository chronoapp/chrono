import React, { useEffect, useRef, createRef, useContext, useState } from 'react'
import clsx from 'clsx'

import * as dates from '../util/dates'
import { format } from '../util/localizer'
import Event from '../models/Event'
import DateSlotMetrics from './utils/DateSlotMetrics'
import EventRow from './EventRow'
import { EventSegment, eventSegments } from './utils/eventLevels'

import { EventActionContext } from './EventActionContext'
import { Selection, SelectRect, Rect, getBoundsForNode } from '../util/Selection'
import { pointInBox, getSlotAtX } from '../util/selection-utils'

interface IProps {
  key: number
  today: Date
  date: Date
  range: Date[]
  events: Event[]
  loading: boolean
}

interface IState {
  segment?: EventSegment
}

const MIN_ROWS = 1
const MAX_ROWS = 5

/**
 * Row used for month and full day events in the week view.
 * TODO: Handle Show More.
 */
class WeekRow extends React.Component<IProps, IState> {
  private rowRef
  private _selection?: Selection
  private dayMetrics
  context!: React.ContextType<typeof EventActionContext>
  static contextType = EventActionContext

  constructor(props) {
    super(props)
    this.rowRef = createRef<HTMLDivElement>()
    this.state = {
      segment: undefined,
    }

    this.dayMetrics = new DateSlotMetrics(props.range, props.events, MAX_ROWS, MIN_ROWS)
    this.updateEvent = this.updateEvent.bind(this)
    this.renderHeadingCell = this.renderHeadingCell.bind(this)
    this.initSelection = this.initSelection.bind(this)
  }

  UNSAFE_componentWillReceiveProps(props) {
    this.dayMetrics = new DateSlotMetrics(props.range, props.events, MAX_ROWS, MIN_ROWS)
  }

  componentDidMount() {
    this.initSelection()
  }

  componentWillUnmount() {
    this._selection?.teardown()
    this._selection = undefined
  }

  private renderBackgroundCells() {
    return (
      <div className="cal-row-bg">
        {this.props.range.map((date, index) => {
          const isOffRange = dates.month(this.props.date) !== dates.month(date)
          return (
            <div key={index} className={clsx('cal-day-bg', isOffRange && 'cal-off-range-bg')}></div>
          )
        })}
      </div>
    )
  }

  private renderHeadingCell(date: Date, index: number) {
    const label = format(date, 'DD')
    const isOffRange = dates.month(this.props.date) !== dates.month(date)
    let isCurrent = dates.eq(date, this.props.today, 'day')

    return (
      <div key={`header_${index}`} className={clsx('cal-date-cell', isOffRange && 'cal-off-range')}>
        <div className={clsx(isCurrent && 'cal-today-bg-month')}>{label}</div>
      </div>
    )
  }

  private updateEvent(event: Event, start: Date, end: Date) {
    const updatedEvent = { ...event, start: start, end: end }
    const segment = eventSegments(updatedEvent, this.dayMetrics.range)

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

    console.log(`${point.x}, ${point.y}`)
    if (!pointInBox(bounds, point.x, point.y)) {
      this.reset()
      return
    }

    let start = dates.merge(
      this.dayMetrics.getDateForSlot(getSlotAtX(bounds, point.x, false, this.dayMetrics.slots)),
      event.start
    )

    let end = dates.add(start, dates.diff(event.start, event.end, 'minutes'), 'minutes')

    this.updateEvent(event, start, end)
  }

  private reset() {
    this.setState({ segment: undefined! })
  }

  private initSelection() {
    const { current } = this.rowRef

    if (current) {
      const container = current.closest('.cal-month-view') as HTMLElement
      if (container) {
        const bounds = getBoundsForNode(current)
        console.log(bounds)

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
          const bounds = getBoundsForNode(current)

          if (this.context.dragAndDropAction?.action === 'MOVE') {
            this.handleMove(point, bounds)
          }
        })

        selection.on('select', (point: SelectRect) => {
          const bounds = getBoundsForNode(current)
          if (!this.state.segment || !pointInBox(bounds, point.x, point.y)) {
            return
          }

          console.log('handleInteractionEnd')
          // this.reset()
          // TODO: Update calendar Event
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
      <div ref={this.rowRef} className="cal-month-row">
        {this.renderBackgroundCells()}

        <div className="cal-row-content">
          <div className="cal-row">{this.props.range.map(this.renderHeadingCell)}</div>

          <div className="cal-dnd-row-body">
            {!this.props.loading &&
              this.dayMetrics.levels.map((segments, idx) => (
                <EventRow
                  key={idx}
                  segments={segments}
                  slotMetrics={this.dayMetrics}
                  isPreview={false}
                />
              ))}

            {this.state.segment && (
              <EventRow
                className={'cal-dnd-row'}
                segments={[this.state.segment]}
                slotMetrics={this.dayMetrics}
                isPreview={true}
              />
            )}
          </div>
        </div>
      </div>
    )
  }
}

export default WeekRow
