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
import { format, fullDayFormat } from '../../util/localizer'
import { addNewLabels } from '..//utils/LabelUtils'

import Event from '../../models/Event'
import Calendar from '../../models/Calendar'
import { Label } from '../../models/Label'
import Alert from '../../models/Alert'
import { EventActionContext } from '../EventActionContext'
import { CalendarsContext } from '../../components/CalendarsContext'
import { AlertsContext } from '../../components/AlertsContext'
import { LabelContext, LabelContextType } from '../../components/LabelsContext'
import { LabelTag } from '../../components/LabelTag'
import LabelTree from '../../components/LabelTree'
import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'

import ContentEditable from '../../lib/ContentEditable'
import TaggableInput from './TaggableInput'

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
    readonly calendarId: string,
    readonly allDay: boolean,
    readonly fullDays: number
  ) {}
}

function EventPopover(props: IProps) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const alertsContext = useContext(AlertsContext)
  const { labelState } = useContext<LabelContextType>(LabelContext)

  console.log(props.event)
  const [eventFields, setEventFields] = useState(
    new EventFields(
      props.event.title,
      props.event.description || '',
      props.event.start,
      props.event.end,
      props.event.labels,
      getSelectedCalendar(props.event.calendar_id)?.id,
      props.event.all_day,
      props.event.all_day ? dates.diff(props.event.end, props.event.start, 'day') : 0
    )
  )

  const isExistingEvent = props.event.id !== -1
  const [readonly, setReadonly] = useState(isExistingEvent)

  const contentEditableRef = createRef<HTMLInputElement>()
  const [addTagDropdownActive, setAddTagDropdownActive] = useState(false)

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
      if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
        onSaveEvent(props.event)
      }
    }
  }

  function onSaveEvent(e: Event) {
    const fullDayEventDetails = eventFields.allDay
      ? {
          all_day: true,
          start_day: fullDayFormat(eventFields.start),
          end_day: fullDayFormat(dates.add(eventFields.start, eventFields.fullDays, 'day')),
        }
      : {
          all_day: false,
          start: eventFields.start,
          end: eventFields.end,
          start_day: null,
          end_day: null,
        }

    const event = {
      ...e,
      title: eventFields.title,
      description: eventFields.description,
      calendar_id: eventFields.calendarId,
      labels: eventFields.labels,
      creating: false,
      ...fullDayEventDetails,
    }
    console.log(event)

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
    const calendar = getSelectedCalendar(eventFields.calendarId)

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
            <div style={{ display: 'flex' }}>
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
            <span>{calendar.summary}</span>
          </div>

          {calendar.isWritable() && (
            <div className="mt-4" style={{ display: 'flex' }}>
              <button className="button is-primary" onClick={() => setReadonly(false)}>
                Edit
              </button>

              <button
                className="button is-light ml-2"
                onClick={() => onDeleteEvent(props.event.id)}
              >
                <Icon className="mr-1" path={mdiDeleteOutline} size={1} />
                Delete{' '}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderSelectCalendar() {
    const calendarValues = Object.values(calendarContext.calendarsById)
      .filter((cal) => cal.isWritable())
      .map((calendar) => {
        return {
          value: calendar.id,
          label: calendar.summary,
          color: calendar.backgroundColor,
        }
      })

    const dot = (color = '#ccc') => ({
      alignItems: 'center',
      display: 'flex',

      ':before': {
        backgroundColor: color,
        borderRadius: 3,
        content: '" "',
        display: 'block',
        marginRight: 5,
        marginLeft: 5,
        height: 12,
        width: 12,
      },
    })

    const colourStyles = {
      option: (styles, { data }) => ({ ...styles, ...dot(data.color) }),
      container: (styles) => ({ ...styles, minWidth: '14em' }),
      singleValue: (styles, { data }) => ({ ...styles, ...dot(data.color) }),
    }

    const defaultCal = calendarContext.calendarsById[eventFields.calendarId]
    const defaultValue = {
      value: defaultCal.id,
      label: defaultCal.summary,
      color: defaultCal.backgroundColor,
    }

    return (
      <Select
        defaultValue={defaultValue}
        options={calendarValues}
        styles={colourStyles}
        onChange={({ value }) => {
          // Forces a color change without an API request.
          // TODO: Discard changes on close.
          setEventFields({ ...eventFields, calendarId: value })
          const event = { ...props.event, calendar_id: value }
          eventActions.eventDispatch({
            type: 'UPDATE_EVENT',
            payload: { event: event, replaceEventId: event.id },
          })
        }}
      />
    )
  }

  function renderEditView() {
    const labels: Label[] = Object.values(labelState.labelsById)

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
            <TaggableInput
              labels={labels}
              title={eventFields.title}
              portalCls={'.cal-event-modal-container'}
              isHeading={false}
              handleChange={(title, labelIds: number[]) => {
                const updatedLabels = addNewLabels(
                  labelState.labelsById,
                  eventFields.labels,
                  labelIds
                )

                setEventFields({ ...eventFields, title, labels: updatedLabels })
              }}
            />
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
              className="button-underline input is-small"
              type="date"
              value={format(eventFields.start, 'YYYY-MM-DD')}
              onChange={(e) => console.log(e.target.value)}
              style={{ flex: 1 }}
            />
            {eventFields.allDay && (
              <TimeSelectFullDay
                days={eventFields.fullDays}
                startDate={eventFields.start}
                onSelectNumDays={(days) => {
                  setEventFields({ ...eventFields, fullDays: days })
                }}
              />
            )}
            {!eventFields.allDay && (
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
            )}
          </div>

          <div className="mt-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={eventFields.allDay}
                onChange={(e) => {
                  const isAllDay = e.target.checked
                  if (isAllDay) {
                    const start = dates.startOf(eventFields.start, 'day')
                    const end = dates.endOf(eventFields.start, 'day')
                    setEventFields({ ...eventFields, allDay: isAllDay, start, end, fullDays: 1 })
                  } else {
                    const start = dates.startOf(eventFields.start, 'day')
                    const end = dates.add(start, 1, 'hours')
                    setEventFields({ ...eventFields, allDay: isAllDay, start, end })
                  }
                }}
              />{' '}
              All day
            </label>
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'top' }}>
            <Icon className="mr-2" path={mdiTextSubject} size={1} />

            <ContentEditable
              innerRef={contentEditableRef}
              className="cal-event-edit-description"
              html={eventFields.description}
              onChange={(e) => setEventFields({ ...eventFields, description: e.target.value })}
            />
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiCalendar} size={1} style={{ flex: 'none' }} />
            {renderSelectCalendar()}
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
