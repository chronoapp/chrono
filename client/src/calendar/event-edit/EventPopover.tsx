import React, { useContext, useState, useEffect, createRef, useRef } from 'react'
import clsx from 'clsx'
import update from 'immutability-helper'
import Select from 'react-select'

import * as dates from '../../util/dates'
import Icon from '@mdi/react'
import {
  mdiTextSubject,
  mdiClockOutline,
  mdiCalendar,
  mdiDeleteOutline,
  mdiClose,
  mdiDelete,
  mdiCheck,
} from '@mdi/js'

import { getAuthToken, createEvent, updateEvent, deleteEvent } from '../../util/Api'
import { format } from '../../util/localizer'

import Event from '../../models/Event'
import Calendar from '../../models/Calendar'
import { Label } from '../../models/Label'
import Alert from '../../models/Alert'
import { EventActionContext } from '../EventActionContext'
import { CalendarsContext } from '../../components/CalendarsContext'
import { AlertsContext } from '../../components/AlertsContext'
import LabelTag from '../../components/LabelTag'
import LabelTree from '../../components/LabelTree'
import TimeSelect from './TimeSelect'

import ContentEditable from '../../lib/ContentEditable'

interface IProps {
  event: Event
}

/**
 * Editable fields in event.
 */
class EventFields {
  public constructor(
    readonly title: string,
    readonly description: string,
    readonly start: Date,
    readonly end: Date,
    readonly labels: Label[],
    readonly calendarId: string
  ) {}
}

function EventPopover(props: IProps) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const alertsContext = useContext(AlertsContext)

  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      getSelectedCalendar(props.event.calendar_id)?.id
    )
  )

  const isExistingEvent = props.event.id !== -1
  const [readonly, setReadonly] = useState(isExistingEvent)
  const titleInputRef = createRef<HTMLInputElement>()
  const [addTagDropdownActive, setAddTagDropdownActive] = useState(false)

  useEffect(() => {
    if (!readonly) {
      titleInputRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', keyboardEvents)
    return function cleanup() {
      document.removeEventListener('keydown', keyboardEvents)
    }
  }, [eventFields])

  if (readonly) {
    return renderReadOnlyView()
  } else {
    return renderEditView()
  }

  function keyboardEvents(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      // onSaveEvent(props.event)
    }
  }

  function onSaveEvent(e: Event) {
    const event = {
      ...e,
      title: eventFields.title,
      description: eventFields.description,
      start: eventFields.start,
      end: eventFields.end,
      calendar_id: eventFields.calendarId,
      labels: eventFields.labels,
      creating: false,
    }
    const token = getAuthToken()

    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })

    const savingAlert = new Alert({ title: 'Saving Event..', isLoading: true })
    alertsContext.addAlert(savingAlert)
    if (isExistingEvent) {
      eventActions.eventDispatch({
        type: 'UPDATE_EVENT',
        payload: { event: event, replaceEventId: event.id },
      })

      updateEvent(token, event).then((event) => {
        eventActions.eventDispatch({
          type: 'UPDATE_EVENT',
          payload: { event, replaceEventId: -1 },
        })
        alertsContext.addAlert(
          new Alert({
            title: 'Event Updated.',
            iconType: mdiCheck,
            autoDismiss: true,
            removeAlertId: savingAlert.id,
          })
        )
      })
    } else {
      eventActions.eventDispatch({ type: 'CREATE_EVENT', payload: event })

      createEvent(token, event).then((event) => {
        console.log(`Created event in db: ${event.id}`)
        eventActions.eventDispatch({
          type: 'UPDATE_EVENT',
          payload: { event, replaceEventId: -1 },
        })
        alertsContext.addAlert(
          new Alert({
            title: 'Event Created.',
            iconType: mdiCheck,
            autoDismiss: true,
            removeAlertId: savingAlert.id,
          })
        )
      })
    }
  }

  function onDeleteEvent(eventId: number) {
    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
    eventActions.eventDispatch({
      type: 'DELETE_EVENT',
      payload: { eventId: props.event.id },
    })
    const token = getAuthToken()

    const savingAlert = new Alert({ title: 'Deleting Event..', isLoading: true })
    alertsContext.addAlert(savingAlert)
    deleteEvent(token, eventId).then(() => {
      alertsContext.addAlert(
        new Alert({
          title: 'Event Deleted',
          iconType: mdiDelete,
          autoDismiss: true,
          removeAlertId: savingAlert.id,
        })
      )
    })
  }

  function getSelectedCalendar(calendarId: string): Calendar {
    const calendar = calendarContext.calendarsById[calendarId]
    if (calendar) {
      return calendar
    } else {
      return calendarContext.getPrimaryCalendar()
    }
  }

  function renderAddTagDropdown() {
    return (
      <div className={clsx('dropdown', addTagDropdownActive && 'is-active')}>
        <div
          onClick={() => setAddTagDropdownActive(!addTagDropdownActive)}
          className="dropdown-trigger"
        >
          <a className="button is-text is-small">add tag</a>
        </div>
        {addTagDropdownActive ? (
          <div className="dropdown-menu" id="dropdown-menu" role="menu">
            <div className="dropdown-content">
              <LabelTree
                allowEdit={false}
                onSelect={(label) => {
                  setAddTagDropdownActive(false)
                  const updatedLabels = [...eventFields.labels, label]
                  setEventFields({ ...eventFields, labels: updatedLabels })
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function renderReadOnlyView() {
    return (
      <div className="has-icon-grey">
        <div className="cal-event-modal-header has-background-white-ter">
          <span
            className="mr-2"
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <Icon
              path={mdiClose}
              size={1}
              className="has-text-grey-light"
              style={{ cursor: 'pointer' }}
            />
          </span>
        </div>

        <div className="cal-event-modal" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="has-text-grey-darker is-size-5">{eventFields.title}</div>

          {props.event.labels && (
            <div className="mt-2" style={{ display: 'flex' }}>
              {props.event.labels.map((label) => (
                <LabelTag key={label.id} label={label} allowEdit={false} />
              ))}
            </div>
          )}

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiClockOutline} size={1} />
            <span>
              {format(eventFields.start, 'YYYY-MM-DD')} {format(eventFields.start, 'hh:mm')} -{' '}
              {format(eventFields.end, 'hh:mm')}
              {format(eventFields.end, 'A')}
            </span>
          </div>

          {props.event.description && (
            <div className="mt-2" style={{ display: 'flex', alignItems: 'flex-start' }}>
              <Icon className="mr-2" path={mdiTextSubject} size={1} />
              <div dangerouslySetInnerHTML={{ __html: props.event.description }}></div>
            </div>
          )}

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiCalendar} size={1} />
            <span>{getSelectedCalendar(eventFields.calendarId).summary}</span>
          </div>

          <div className="mt-4" style={{ display: 'flex' }}>
            <button className="button is-primary" onClick={() => setReadonly(false)}>
              Edit
            </button>

            <button className="button is-light ml-2" onClick={() => onDeleteEvent(props.event.id)}>
              <Icon className="mr-1" path={mdiDeleteOutline} size={1} />
              Delete{' '}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderEditView() {
    return (
      <div className="has-icon-grey">
        <div className="cal-event-modal-header has-background-white-ter">
          <div
            className="mr-2"
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <Icon
              path={mdiClose}
              size={1}
              className="has-text-grey-light"
              style={{ cursor: 'pointer' }}
            />
          </div>
        </div>

        <div className="cal-event-modal" style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <input
              className="input"
              type="text"
              placeholder="title"
              value={eventFields.title}
              ref={titleInputRef}
              onChange={(e) => {
                setEventFields({ ...eventFields, title: e.target.value })
                // setTitle(e.target.value)
              }}
              style={{ width: '100%' }}
            ></input>
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            {eventFields.labels.map((label) => (
              <LabelTag
                key={label.id}
                label={label}
                allowEdit={true}
                onClickDelete={(e) => {
                  const rmIdx = eventFields.labels.indexOf(label)
                  const updatedLabels = update(eventFields.labels, { $splice: [[rmIdx, 1]] })
                  setEventFields({ ...eventFields, labels: updatedLabels })
                }}
              />
            ))}
            {renderAddTagDropdown()}
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiClockOutline} size={1} style={{ flex: 'none' }} />
            <input
              className="input is-small"
              type="date"
              value={format(eventFields.start, 'YYYY-MM-DD')}
              onChange={(e) => console.log(e.target.value)}
              style={{ flex: 1 }}
            />
            <TimeSelect
              start={eventFields.start}
              end={eventFields.end}
              onSelectStartDate={(date) => {
                setEventFields({ ...eventFields, start: date })
                const event = { ...props.event, start: date }
                eventActions.eventDispatch({
                  type: 'UPDATE_EVENT',
                  payload: { event: event, replaceEventId: event.id },
                })
              }}
              onSelectEndDate={(date) => {
                setEventFields({ ...eventFields, end: date })
                const event = { ...props.event, end: date }
                eventActions.eventDispatch({
                  type: 'UPDATE_EVENT',
                  payload: { event: event, replaceEventId: event.id },
                })
              }}
            />
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'top' }}>
            <Icon className="mr-2" path={mdiTextSubject} size={1} />

            <ContentEditable
              className="cal-event-edit-description"
              html={eventFields.description}
              onChange={(e) => setEventFields({ ...eventFields, description: e.target.value })}
            />
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiCalendar} size={1} style={{ flex: 'none' }} />
            <div className="select">
              <select
                value={eventFields.calendarId}
                onChange={(e) => {
                  // Forces a color change without an API request.
                  setEventFields({ ...eventFields, calendarId: e.target.value })
                  const event = { ...props.event, calendar_id: e.target.value }
                  eventActions.eventDispatch({
                    type: 'UPDATE_EVENT',
                    payload: { event: event, replaceEventId: event.id },
                  })
                }}
              >
                {Object.values(calendarContext.calendarsById)
                  .filter((cal) => cal.isWritable())
                  .map((calendar) => {
                    return (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                      </option>
                    )
                  })}
              </select>
            </div>
          </div>

          <div className="mt-4" style={{ display: 'flex' }}>
            <button className="button is-primary" onClick={() => onSaveEvent(props.event)}>
              Save
            </button>

            {isExistingEvent ? (
              <button
                className="button is-light ml-2"
                onClick={() => onDeleteEvent(props.event.id)}
              >
                <Icon className="mr-1" path={mdiDeleteOutline} size={1} />
                Delete{' '}
              </button>
            ) : (
              <button
                className="button is-light ml-2"
                onClick={() => {
                  eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
                }}
              >
                Discard
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}

export default EventPopover
