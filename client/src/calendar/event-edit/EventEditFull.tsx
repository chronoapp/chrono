import React, { useContext, useState, useRef } from 'react'

import { MdClose } from 'react-icons/md'
import { FiMail } from 'react-icons/fi'
import { BsArrowRepeat } from 'react-icons/bs'

import { addNewLabels } from '../utils/LabelUtils'

import { EventActionContext } from '../EventActionContext'
import Event from '../../models/Event'
import { Label } from '../../models/Label'
import { LabelContext, LabelContextType } from '../../components/LabelsContext'

import RecurringEventEditor from './RecurringEventEditor'
import TaggableInput from './TaggableInput'

interface IProps {
  event: Event
}

/**
 * Full view for event editing.
 */
function EventEditFull(props: IProps) {
  const eventActions = useContext(EventActionContext)
  const [recurringEventModalEnabled, setRecurringEventModalEnabled] = useState(false)
  const { labelState } = useContext<LabelContextType>(LabelContext)
  const recurringEditRef = useRef()

  const [event, setEvent] = useState(props.event)

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

          <div className="mt-2 is-flex is-align-items-center">
            <FiMail className="mr-2" size={'1.25em'} />
            <input className="input" type="email" placeholder="participants" value="" />
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
        </section>

        <footer className="modal-card-foot">
          <button className="button is-primary">Save changes</button>
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

export default EventEditFull
