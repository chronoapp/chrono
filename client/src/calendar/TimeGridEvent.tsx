import React from 'react'

import clsx from 'clsx'
import Event from '../models/Event'
import { timeFormatShort } from '../util/localizer'

import { Direction, EventActionContext } from './EventActionContext'

interface IProps {
  event: Event
  style: { top: number; width: number; height: number; xOffset: number; border: string }
  label: string
  isPreview: boolean
  innerRef?: React.Ref<HTMLDivElement>
}

function stringifyPercent(v: number | string) {
  return typeof v === 'string' ? v : v + '%'
}

class TimeGridEvent extends React.Component<IProps> {
  static contextType = EventActionContext

  constructor(props) {
    super(props)

    this.handleResize = this.handleResize.bind(this)
    this.handleStartDragging = this.handleStartDragging.bind(this)
    this.renderAnchor = this.renderAnchor.bind(this)
    this.handleClickEvent = this.handleClickEvent.bind(this)
  }

  private handleResize(e, direction: Direction) {
    if (e.button !== 0) {
      return
    }
    e.stopPropagation()
    this.context?.onBeginAction(this.props.event, 'RESIZE', direction)
  }

  private handleStartDragging(e) {
    if (e.button === 0) {
      this.context?.onBeginAction(this.props.event, 'MOVE')
    }
  }

  private handleClickEvent(e) {
    if (!this.props.event.creating) {
      this.context?.eventDispatch({ type: 'INIT_EDIT_EVENT', payload: this.props.event })
    }
  }

  private renderAnchor(direction: Direction) {
    return (
      <div
        className={`cal-dnd-resize-ns-anchor`}
        onMouseDown={(e) => this.handleResize(e, direction)}
      ></div>
    )
  }

  public render() {
    const { event } = this.props

    const diffMin = (event.end.getTime() - event.start.getTime()) / 60000
    const displayTitle = event.title ? event.title : '(No title)'

    let inner
    if (diffMin <= 30) {
      inner = (
        <div
          className={clsx('cal-event-content', diffMin <= 15 && 'cal-small-event')}
          style={{ display: 'flex' }}
        >
          <span>{displayTitle}</span>
          <span className="cal-ellipsis" style={{ fontSize: '90%', flex: 1 }}>
            {`, ${timeFormatShort(event.start)}`}
          </span>
        </div>
      )
    } else {
      inner = [
        <div key="1" className="cal-event-content" style={{ paddingTop: '3px' }}>
          {displayTitle}
        </div>,
        <div key="2" className="cal-event-label">
          {this.props.label}
        </div>,
      ]
    }

    const dnd = this.context?.dragAndDropAction
    const isInteracting =
      dnd && dnd.interacting && dnd.event.id === this.props.event.id && !this.props.isPreview

    // Tiny gap to separate events.
    const finalHeight = this.props.style.height - 0.15

    return (
      <div
        ref={this.props.innerRef}
        className={clsx({
          'cal-event': true,
          'cal-dnd-interacting': isInteracting,
          'cal-editing': event.creating,
        })}
        style={{
          backgroundColor: event.backgroundColor,
          top: stringifyPercent(this.props.style.top),
          left: stringifyPercent(this.props.style.xOffset),
          width: stringifyPercent(this.props.style.width),
          height: stringifyPercent(finalHeight),
          border: this.props.style.border,
          color: event.foregroundColor,
        }}
        onMouseDown={this.handleStartDragging}
        onTouchStart={this.handleStartDragging}
        onClick={this.handleClickEvent}
      >
        {inner}
        {this.renderAnchor('DOWN')}
      </div>
    )
  }
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <TimeGridEvent innerRef={ref} {...props} />
))
