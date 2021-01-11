import React, { useContext, useState, useEffect, createRef } from 'react'
import clsx from 'clsx'
import produce from 'immer'
import moment from 'moment'

import * as dates from '../../util/dates'
import { MdClose } from 'react-icons/md'
import { FiCalendar, FiClock, FiAlignLeft, FiTrash } from 'react-icons/fi'

import { format, fullDayFormat } from '../../util/localizer'
import { addNewLabels } from '../utils/LabelUtils'

import Event from '../../models/Event'
import Calendar from '../../models/Calendar'
import { Label } from '../../models/Label'
import { EventActionContext } from '../EventActionContext'
import { CalendarsContext } from '../../components/CalendarsContext'
import { LabelContext, LabelContextType } from '../../components/LabelsContext'
import { LabelTag } from '../../components/LabelTag'
import LabelTree from '../../components/LabelTree'

import withEventEditor, { InjectedEventEditProps } from './withEventEditor'
import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'
import SelectCalendar from './SelectCalendar'
import ContentEditable from '../../lib/ContentEditable'
import TaggableInput from './TaggableInput'

interface IProps extends InjectedEventEditProps {
  event: Event
}

/**
 * Editable fields in event.
 */
export class EventFields {
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
  const { labelState } = useContext<LabelContextType>(LabelContext)

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
  const contentEditableRef = createRef<HTMLInputElement>()
  const [addTagDropdownActive, setAddTagDropdownActive] = useState(false)

  useEffect(() => {
    document.addEventListener('keydown', keyboardEvents)
    return function cleanup() {
      document.removeEventListener('keydown', keyboardEvents)
    }
  }, [eventFields])

  const isReadOnly = eventActions.eventState.editingEvent?.editMode == 'READ'
  if (isReadOnly) {
    return renderReadOnlyView()
  } else {
    return renderEditView()
  }

  function setReadOnly(readOnly: boolean) {
    eventActions.eventDispatch({ type: 'UPDATE_EDIT_MODE', payload: readOnly ? 'READ' : 'EDIT' })
  }

  function keyboardEvents(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
        props.onSaveEvent(getUpdatedEvent(props.event, eventFields))
      }
    }
  }

  function getUpdatedEvent(e: Event, fields: EventFields) {
    const fullDayEventDetails = fields.allDay
      ? {
          all_day: true,
          start_day: fullDayFormat(fields.start),
          end_day: fullDayFormat(dates.add(fields.start, fields.fullDays, 'day')),
        }
      : {
          all_day: false,
          start: fields.start,
          end: fields.end,
          start_day: null,
          end_day: null,
        }

    const event = {
      ...e,
      title: fields.title,
      description: fields.description,
      calendar_id: fields.calendarId,
      labels: fields.labels,
      ...fullDayEventDetails,
    }

    return event
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
      <div>
        <div className="cal-event-modal-header has-background-white-ter">
          <span
            className="mr-2"
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <MdClose style={{ cursor: 'pointer' }} className="has-text-grey" />
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
            <FiClock className="mr-2" />
            <span>
              {format(eventFields.start, 'YYYY-MM-DD')} {format(eventFields.start, 'hh:mm')} -{' '}
              {format(eventFields.end, 'hh:mm')}
              {format(eventFields.end, 'A')}
            </span>
          </div>

          {props.event.description && (
            <div className="mt-2" style={{ display: 'flex', alignItems: 'flex-start' }}>
              <FiAlignLeft className="mr-2" />
              <div dangerouslySetInnerHTML={{ __html: props.event.description }}></div>
            </div>
          )}

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <FiCalendar className="mr-2" />
            <span>{calendar.summary}</span>
          </div>

          {calendar.isWritable() && (
            <div className="mt-4" style={{ display: 'flex' }}>
              <button className="button is-small is-primary" onClick={() => setReadOnly(false)}>
                Edit
              </button>

              <button
                className="button is-small is-light ml-2"
                onClick={() => props.onDeleteEvent(props.event.id)}
              >
                <FiTrash className="mr-1" />
                Delete{' '}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderEditView() {
    const labels: Label[] = Object.values(labelState.labelsById)

    return (
      <>
        <div className="cal-event-modal-header has-background-white-ter">
          <div
            className="mr-2 is-flex is-align-items-center"
            style={{ height: '100%' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <MdClose style={{ cursor: 'pointer' }} className="has-text-grey" />
          </div>
        </div>

        <div className="cal-event-modal is-flex is-flex-direction-column">
          <div>
            <TaggableInput
              labels={labels}
              title={eventFields.title}
              portalCls={'.cal-event-modal-container'}
              isHeading={false}
              onBlur={() => {
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getUpdatedEvent(props.event, eventFields),
                })
              }}
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
                  const updatedLabels = produce(eventFields.labels, (labels) => {
                    labels.splice(rmIdx, 1)
                  })
                  setEventFields({ ...eventFields, labels: updatedLabels })
                }}
              />
            ))}
            {renderAddTagDropdown()}
          </div>

          <div className="mt-2 is-flex is-align-items-center">
            <FiClock className="mr-2" size={'1.2em'} />
            <input
              className="button-underline input is-small"
              type="date"
              value={format(eventFields.start, 'YYYY-MM-DD')}
              onChange={(e) => {
                const m = moment(e.target.value, 'YYYY-MM-DD')
                const duration = dates.diff(eventFields.end, eventFields.start, 'minutes')

                const start = dates.merge(m.toDate(), eventFields.start)
                const end = dates.add(start, duration, 'minutes')
                const updatedFields = { ...eventFields, start, end }
                setEventFields(updatedFields)

                eventActions.setSelectedDate(start)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getUpdatedEvent(props.event, updatedFields),
                })
              }}
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
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: { ...props.event, end: date },
                  })
                }}
              />
            )}
          </div>

          <div className="mt-2 is-flex is-justify-content-flex-end">
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

          <div className="mt-2 is-flex is-align-items-center">
            <FiCalendar className="mr-2" size={'1.2em'} />
            <SelectCalendar
              defaultCalendarId={eventFields.calendarId}
              calendarsById={calendarContext.calendarsById}
              onChange={(value) => {
                // Forces a color change without an API request.
                // TODO: Discard changes on close.
                setEventFields({ ...eventFields, calendarId: value })
                const event = { ...props.event, calendar_id: value }
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: event,
                })
              }}
            />
          </div>

          <div className="mt-2 is-flex is-align-items-top">
            <FiAlignLeft className="mr-2" size={'1.2em'} />
            <ContentEditable
              innerRef={contentEditableRef}
              className="cal-event-edit-description"
              html={eventFields.description}
              onChange={(e) => setEventFields({ ...eventFields, description: e.target.value })}
              style={{ minHeight: '3em' }}
            />
          </div>

          <div className="mt-4 is-flex is-justify-content-space-between">
            <div className="is-flex">
              <button
                className="button is-small is-primary"
                onClick={() => props.onSaveEvent(getUpdatedEvent(props.event, eventFields))}
              >
                Save
              </button>

              {isExistingEvent ? (
                <button
                  className="button is-small is-light ml-2"
                  onClick={() => props.onDeleteEvent(props.event.id)}
                >
                  <FiTrash className="mr-1" />
                  Delete{' '}
                </button>
              ) : (
                <button
                  className="button is-small is-light ml-2"
                  onClick={() => {
                    eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
                  }}
                >
                  Discard
                </button>
              )}
            </div>

            <button
              className="button is-small is-text ml-2"
              onClick={() => {
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: getUpdatedEvent(props.event, eventFields),
                })
                eventActions.eventDispatch({ type: 'UPDATE_EDIT_MODE', payload: 'FULL_EDIT' })
              }}
            >
              More Options
            </button>
          </div>
        </div>
      </>
    )
  }
}

export default withEventEditor(EventPopover)
