import React, { useContext, useState, useEffect, createRef } from 'react'

import Icon from '@mdi/react'
import { mdiTextSubject, mdiClockOutline, mdiCalendar, mdiDeleteOutline, mdiClose } from '@mdi/js'

import { createEvent, getAuthToken, deleteEvent } from '../util/Api'
import Event from '../models/Event'
import Calendar from '../models/Calendar'
import { EventActionContext } from './EventActionContext'
import { CalendarsContext } from '../components/CalendarsContext'
import { format } from '../util/localizer'

interface IProps {
  event: Event
}

function EventPopover(props: IProps) {
  const eventActions = useContext(EventActionContext)
  const calendarContext = useContext(CalendarsContext)

  const [title, setTitle] = useState(props.event.title)
  const [description, setDescription] = useState(props.event.description)
  const [start, setStart] = useState(props.event.start)
  const [end, setEnd] = useState(props.event.end)
  const [calendarId, setCalendarId] = useState(getSelectedCalendar().id)
  const isExistingEvent = props.event.id !== -1

  const [readonly, setReadonly] = useState(isExistingEvent)

  const titleInputRef = createRef<HTMLInputElement>()
  useEffect(() => {
    if (!readonly) {
      titleInputRef.current.focus()
    }
  }, [])

  if (readonly) {
    return renderReadOnlyView()
  } else {
    return renderEditView()
  }

  function onCreateOrUpdateEvent(event: Event) {
    event.title = title
    event.description = description
    event.start = start
    event.end = end
    event.calendar_id = calendarId

    if (isExistingEvent) {
      console.log('TODO: Update Existing')
    } else {
      eventActions.eventDispatch({ type: 'CREATE_EVENT', payload: event })
      const token = getAuthToken()
      createEvent(token, event).then((event) => {
        console.log(`Created event in db: ${event.id}`)
        eventActions.eventDispatch({ type: 'UPDATE_EVENT', payload: { event, replaceEventId: -1 } })
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
    deleteEvent(token, eventId)
  }

  function getSelectedCalendar(): Calendar {
    const originalCalendars = Object.values(calendarContext.calendarsById)

    const calendars = originalCalendars.filter((calendar) => {
      calendar.id == props.event.calendar_id
    })
    if (calendars.length === 1) {
      return calendars[0]
    }

    const primaryCalendar = originalCalendars.filter((c) => c.primary)
    if (primaryCalendar.length === 1) {
      return primaryCalendar[0]
    }

    throw new Error('No calendar.')
  }

  function renderReadOnlyView() {
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
          <div className="has-text-grey-darker is-size-5">{title}</div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiClockOutline} size={1} />
            <span>
              {format(start, 'YYYY-MM-DD')} {format(start, 'hh:mm')} - {format(end, 'hh:mm')}
              {format(end, 'A')}
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
            <span>{calendarId}</span>
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
              type="text"
              placeholder="title"
              value={title}
              ref={titleInputRef}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%' }}
            ></input>
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiClockOutline} size={1} />
            <input
              type="date"
              value={format(start, 'YYYY-MM-DD')}
              onChange={(e) => console.log(e.target.value)}
            />
            <span>{format(start, 'hh:mm')}</span> to <span>{format(end, 'HH:mm')}</span>
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiTextSubject} size={1} />
            <input
              type="textarea"
              name="description"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center' }}>
            <Icon className="mr-2" path={mdiCalendar} size={1} />
            <div className="select">
              <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
                {Object.values(calendarContext.calendarsById).map((calendar) => {
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
            <button
              className="button is-primary"
              onClick={() => onCreateOrUpdateEvent(props.event)}
            >
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
