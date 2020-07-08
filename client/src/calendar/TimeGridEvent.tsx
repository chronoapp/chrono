import React from 'react'

import clsx from 'clsx'
import Event from '../models/Event'

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

  private renderAnchor(direction: Direction) {
    return (
      <div
        className={`cal-dnd-resize-ns-anchor`}
        onMouseDown={(e) => this.handleResize(e, direction)}
      ></div>
    )
  }

  public render() {
    const title = this.props.event.title
    const isEditing = this.props.event.creating
    const inner = [
      <div key="1" className="cal-event-content">
        {title}
      </div>,
      <div key="2" className="cal-event-label">
        {this.props.label}
      </div>,
    ]

    const dnd = this.context?.dragAndDropAction
    const isInteracting =
      dnd && dnd.interacting && dnd.event.id === this.props.event.id && !this.props.isPreview

    return (
      <div
        ref={this.props.innerRef}
        className={clsx({
          'cal-event': true,
          'cal-dnd-interacting': isInteracting,
          'cal-editing': isEditing,
        })}
        style={{
          top: stringifyPercent(this.props.style.top),
          left: stringifyPercent(this.props.style.xOffset),
          width: stringifyPercent(this.props.style.width),
          height: stringifyPercent(this.props.style.height),
          border: this.props.style.border,
          zIndex: this.props.isPreview ? 10 : 1,
        }}
        onMouseDown={this.handleStartDragging}
        onTouchStart={this.handleStartDragging}
      >
        {this.renderAnchor('UP')}
        {inner}
        {this.renderAnchor('DOWN')}
      </div>
    )
  }
}

export default React.forwardRef<HTMLDivElement, IProps>((props, ref) => (
  <TimeGridEvent innerRef={ref} {...props} />
))
