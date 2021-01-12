import React, { useContext, useState, useRef } from 'react'
import produce from 'immer'
import * as dates from '../../util/dates'

import { MdClose } from 'react-icons/md'
import { FiMail } from 'react-icons/fi'
import { BsArrowRepeat } from 'react-icons/bs'
import { FiCalendar, FiAlignLeft, FiClock } from 'react-icons/fi'

import { EventActionContext } from '../EventActionContext'
import { CalendarsContext } from '../../components/CalendarsContext'
import Event from '../../models/Event'
import { Label } from '../../models/Label'

import { format } from '../../util/localizer'
import { addNewLabels } from '../utils/LabelUtils'
import ContentEditable from '../../lib/ContentEditable'
import { LabelTag } from '../../components/LabelTag'
import { LabelContext, LabelContextType } from '../../components/LabelsContext'

import SelectCalendar from './SelectCalendar'
import RecurringEventEditor from './RecurringEventEditor'
import TaggableInput from './TaggableInput'
import TimeSelect from './TimeSelect'
import TimeSelectFullDay from './TimeSelectFullDay'

import useEventService from './useEventService'

/**
 * Full view for event editing.
 */
export default function EventEditFull(props: { event: Event }) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)
  const [recurringEventModalEnabled, setRecurringEventModalEnabled] = useState(false)
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const recurringEditRef = useRef()
  const { saveEvent } = useEventService()

  const [event, setEvent] = useState(props.event)
  const [tmpFullDays, setFullDays] = useState(1)

  function renderRecurringEventModal() {
    if (!recurringEventModalEnabled) {
      return
    }

    return (
      <div className="modal is-active">
        <div className="modal-background"></div>
        <div ref={recurringEditRef.current} className="modal-card" style={{ width: 300 }}>
          <section className="modal-card-body has-text-left pb-2">
            <RecurringEventEditor initialDate={event.start} />

            <div className="mt-2 is-flex is-justify-content-flex-end">
              <button className="button is-small is-primary is-ghost">Done</button>
              <button
                className="button is-small is-light is-ghost mr-1"
                onClick={() => setRecurringEventModalEnabled(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const labels: Label[] = Object.values(labelState.labelsById)

  return (
    <div className="modal is-active">
      <div className="modal-background"></div>

      <div className="modal-card">
        <div className="modal-card-head cal-event-modal-header has-background-white-ter">
          <span
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            onClick={(e) => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            <MdClose className="has-text-grey-light" style={{ cursor: 'pointer' }} />
          </span>
        </div>

        <section className="modal-card-body has-text-left">
          <div className="is-flex is-align-items-center">
            <span className="mr-2" style={{ width: '1.25em' }} />
            <TaggableInput
              labels={labels}
              title={event.title}
              wrapperCls={'is-fullwidth'}
              portalCls={'.cal-event-modal-container'}
              isHeading={false}
              placeholder={!event.title ? Event.getDefaultTitle(event) : ''}
              handleChange={(title, labelIds: number[]) => {
                const updatedLabels = addNewLabels(labelState.labelsById, event.labels, labelIds)
                const updatedEvent = { ...event, title: title, labels: updatedLabels }
                setEvent(updatedEvent)
              }}
              onBlur={() => {
                eventActions.eventDispatch({ type: 'UPDATE_EDIT_EVENT', payload: event })
              }}
            />
          </div>

          <div className="is-flex is-align-items-center is-flex-wrap-wrap">
            <span className="mr-2" style={{ width: '1.25em' }} />
            {event.labels.map((label) => (
              <div className="mt-2">
                <LabelTag
                  key={label.id}
                  label={label}
                  allowEdit={true}
                  onClickDelete={(e) => {
                    const rmIdx = event.labels.indexOf(label)
                    const updatedLabels = produce(event.labels, (labels) => {
                      labels.splice(rmIdx, 1)
                    })
                    setEvent({ ...event, labels: updatedLabels })
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-2 is-flex is-align-items-center">
            <FiMail className="mr-2" size={'1.25em'} />
            <input
              className="input"
              type="email"
              placeholder="participants"
              value="todo"
              onChange={(e) => {}}
            />
          </div>

          <div className="mt-2 is-flex is-align-items-center">
            <FiClock className="mr-2" size={'1.2em'} />
            <input
              className="button-underline input is-small"
              type="date"
              value={format(event.start, 'YYYY-MM-DD')}
              onChange={(e) => console.log(e.target.value)}
              style={{ flex: 1 }}
            />
            {event.all_day && (
              <TimeSelectFullDay
                days={tmpFullDays}
                startDate={event.start}
                onSelectNumDays={(days) => {
                  setFullDays(days)
                }}
              />
            )}

            {!event.all_day && (
              <TimeSelect
                start={event.start}
                end={event.end}
                onSelectStartDate={(date) => {
                  const event = { ...props.event, start: date }
                  setEvent({ ...event, start: date })
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: event,
                  })
                }}
                onSelectEndDate={(date) => {
                  const event = { ...props.event, end: date }
                  setEvent({ ...event, end: date })
                  eventActions.eventDispatch({
                    type: 'UPDATE_EDIT_EVENT',
                    payload: event,
                  })
                }}
              />
            )}

            <label className="checkbox">
              <input
                type="checkbox"
                checked={event.all_day}
                onChange={(e) => {
                  const isAllDay = e.target.checked
                  if (isAllDay) {
                    const start = dates.startOf(event.start, 'day')
                    const end = dates.endOf(event.start, 'day')
                    setEvent({ ...event, all_day: isAllDay, start, end })
                    setFullDays(1)
                  } else {
                    const start = dates.startOf(event.start, 'day')
                    const end = dates.add(start, 1, 'hours')
                    setEvent({ ...event, all_day: isAllDay, start, end })
                  }
                }}
              />{' '}
              All day
            </label>
          </div>

          <div className="mt-2 is-flex is-align-items-center">
            <BsArrowRepeat className="mr-2" size={'1.25em'} />
            <label className="cal-checkbox-container has-text-left tag-block">
              <input
                type="checkbox"
                checked={recurringEventModalEnabled}
                className="cal-checkbox"
                onChange={(v) => {
                  setRecurringEventModalEnabled(!recurringEventModalEnabled)
                }}
              />
              <span className="cal-checkmark"></span>
              <span style={{ paddingLeft: '5px' }}>Repeating</span>
            </label>
          </div>

          {renderRecurringEventModal()}

          <div className="mt-2 is-flex is-align-items-center">
            <FiCalendar size={'1.25em'} />
            <SelectCalendar
              defaultCalendarId={event.calendar_id}
              calendarsById={calendarContext.calendarsById}
              onChange={(value) => {
                const updatedEvent = { ...event, calendar_id: value }
                setEvent(updatedEvent)
                eventActions.eventDispatch({
                  type: 'UPDATE_EDIT_EVENT',
                  payload: updatedEvent,
                })
              }}
            />
          </div>

          <div className="mt-2 is-flex is-align-items-top">
            <FiAlignLeft className="mr-2" size={'1.25em'} />

            <ContentEditable
              className="cal-event-edit-description"
              html={event.description}
              onChange={(e) => setEvent({ ...event, description: e.target.value })}
              style={{ minHeight: '4em' }}
            />
          </div>
        </section>

        <footer className="modal-card-foot">
          <button
            className="button is-primary"
            onClick={() => {
              saveEvent(event)
            }}
          >
            Save changes
          </button>
          <button
            className="button"
            onClick={() => {
              eventActions.eventDispatch({ type: 'CANCEL_SELECT' })
            }}
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
