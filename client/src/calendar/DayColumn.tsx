import React from 'react'
import clsx from 'clsx'
import { mdiCheck } from '@mdi/js'

import Popover from '../lib/popover/Popover'

import SlotMetrics from './utils/SlotMetrics'
import getStyledEvents from './utils/DayEventLayout'
import { timeRangeFormat } from '../util/localizer'
import * as dates from '../util/dates'
import { Selection, SelectRect, EventData, getBoundsForNode, isEvent } from '../util/Selection'
import { updateEvent, getAuthToken } from '../util/Api'

import TimeSlotGroup from './TimeSlotGroup'
import TimeGridEvent from './TimeGridEvent'
import EventPopover from './event-edit/EventPopover'
import Event from '../models/Event'
import Alert from '../models/Alert'

import DragDropEventContainer from './DragDropEventContainer'
import { EventActionContext } from './EventActionContext'
import { AlertsContext, AlertsContextType } from '../components/AlertsContext'

interface IProps {
  date: Date
  step: number
  timeslots: number
  min: Date
  max: Date
  events: Event[]
  isCurrentDay: boolean
  now: Date
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

  renderEventDialog(event: Event) {
    return <EventPopover event={event} />
  }

  renderEvents(slotMetrics) {
    const { events, step, now } = this.props

    const styledEvents = getStyledEvents(events, step, slotMetrics)

    const dnd = this.context?.dragAndDropAction
    const editingEventId = this.context?.eventState.editingEventId

    return styledEvents.map(({ event, style }, idx) => {
      const label = timeRangeFormat(event.start, event.end)
      const isInteracting = dnd && dnd.interacting && dnd.event.id === event.id
      const isCreating = editingEventId === event.id

      if (isCreating && !isInteracting) {
        return (
          <Popover
            key={`evt_${idx}`}
            containerClassName={'cal-event-modal-container'}
            content={(args) => this.renderEventDialog(event)}
            isOpen={true}
            position={['right', 'left', 'bottom', 'top']}
            padding={5}
          >
            <TimeGridEvent
              now={now}
              event={event}
              label={label}
              style={style}
              isPreview={false}
              getContainerRef={this.getContainerRef}
            />
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
            getContainerRef={this.getContainerRef}
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

  onEventUpdated(event: Event, alertsContext: AlertsContextType) {
    if (!Event.isNewEvent(event)) {
      const alert = new Alert({ title: 'Saving Event..', isLoading: true })
      alertsContext.addAlert(alert)
      updateEvent(getAuthToken(), event)
        .then((newEvent) => {
          this.context.eventDispatch({
            type: 'UPDATE_EVENT',
            payload: { event: newEvent, replaceEventId: event.id },
          })
        })
        .then(() => {
          alertsContext.addAlert(
            new Alert({
              title: 'Event Updated.',
              iconType: mdiCheck,
              removeAlertId: alert.id,
              autoDismiss: true,
            })
          )
        })
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
          console.log('dragDropAction')
          return false
        }

        if (this.context?.eventState.editingEventId) {
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
            const event = new Event(-1, '', '', '', startDate, endDate, [], false, '', '#fff')

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
        const endDate = dates.add(startDate, 60, 'minutes')
        const event = new Event(-1, '', '', '', startDate, endDate, [], false, '', '#fff')
        this.context?.eventDispatch({
          type: 'INIT_EDIT_NEW_EVENT',
          payload: event,
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
    const diffMinutes = (selectRange.endDate.getTime() - selectRange.startDate.getTime()) / 60000
    return (
      <div
        className={clsx(
          'cal-slot-selection',
          'is-dragging',
          diffMinutes <= 15 && 'cal-small-event'
        )}
        style={{ top: `${selectRange.top}%`, height: `${selectRange.height}%` }}
      >
        <span>{timeRangeFormat(selectRange.startDate, selectRange.endDate)}</span>
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

        <AlertsContext.Consumer>
          {(alertsContext) => (
            <DragDropEventContainer
              onEventUpdated={(event) => this.onEventUpdated(event, alertsContext)}
              slotMetrics={this.slotMetrics}
            >
              <div className="cal-events-container">{this.renderEvents(this.slotMetrics)}</div>
            </DragDropEventContainer>
          )}
        </AlertsContext.Consumer>

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
